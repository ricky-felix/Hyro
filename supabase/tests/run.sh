#!/usr/bin/env bash
# =============================================================================
# run.sh — Execute Hyro pgTAP test suite
# =============================================================================
# Requirements (see README.md for full setup instructions):
#   - psql CLI connected to a Postgres 15+ database
#   - pgTAP extension installed in that database (CREATE EXTENSION pgtap)
#   - pg_prove CLI tool (from the pgTAP Perl distribution)
#   - Schema + all migrations applied before running tests
#
# Two supported modes:
#   1. supabase CLI (local dev DB):
#        supabase start
#        supabase db reset   # applies schema.sql + all migrations
#        bash supabase/tests/run.sh --mode supabase
#
#   2. Docker Postgres (CI / standalone):
#        bash supabase/tests/run.sh --mode docker
#
# Environment variables (override defaults):
#   PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SCHEMA_FILE="$REPO_ROOT/supabase/schema.sql"
TESTS_DIR="$SCRIPT_DIR"

MODE="${1:-}"
if [[ "$MODE" == "--mode" ]]; then
  MODE="${2:-supabase}"
else
  MODE="supabase"   # default
fi

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ---------------------------------------------------------------------------
# Mode: supabase CLI local stack
# ---------------------------------------------------------------------------
run_supabase_mode() {
  info "Mode: supabase CLI local stack"

  if ! command -v supabase &>/dev/null; then
    error "supabase CLI not found. Install: https://supabase.com/docs/guides/cli"
    exit 1
  fi

  if ! command -v pg_prove &>/dev/null; then
    error "pg_prove not found. Install pgTAP Perl client:"
    error "  cpan TAP::Parser::SourceHandler::pgTAP"
    error "  or: brew install pgtap (macOS)"
    exit 1
  fi

  info "Checking supabase local stack is running..."
  supabase status --output env | grep -q "DB_URL" || {
    warn "Local stack may not be running. Starting..."
    supabase start
  }

  # Extract connection details from supabase status
  eval "$(supabase status --output env 2>/dev/null | grep -E '^(DB_URL|PGHOST|PGPORT|PGUSER|PGPASSWORD|PGDATABASE)=')"

  # Ensure pgtap is installed
  psql "${DB_URL:-}" -c "CREATE EXTENSION IF NOT EXISTS pgtap;" 2>/dev/null \
    || psql -c "CREATE EXTENSION IF NOT EXISTS pgtap;"

  info "Running pgTAP tests with pg_prove..."
  pg_prove \
    --verbose \
    --recursive \
    --ext .sql \
    "${DB_URL:+--dbname=$DB_URL}" \
    "$TESTS_DIR"/0*.sql
}

# ---------------------------------------------------------------------------
# Mode: Docker Postgres (useful for CI with no supabase CLI)
# ---------------------------------------------------------------------------
run_docker_mode() {
  info "Mode: Docker Postgres + pgTAP"

  if ! command -v docker &>/dev/null; then
    error "docker not found. Install Docker: https://docs.docker.com/get-docker/"
    exit 1
  fi

  CONTAINER_NAME="arisan_pgtap_test"
  PG_VERSION="${PG_VERSION:-15}"
  PGPASSWORD="${PGPASSWORD:-postgres}"
  PGDATABASE="${PGDATABASE:-arisan_test}"
  PGUSER="${PGUSER:-postgres}"
  PGPORT="${PGPORT:-54322}"   # non-standard to avoid conflicts

  info "Pulling supabase/postgres image (includes pgTAP)..."
  docker pull "supabase/postgres:$PG_VERSION" 2>/dev/null \
    || docker pull "postgres:$PG_VERSION"

  # Remove stale container if exists
  docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

  info "Starting Postgres container ($CONTAINER_NAME)..."
  docker run -d \
    --name "$CONTAINER_NAME" \
    -e POSTGRES_PASSWORD="$PGPASSWORD" \
    -e POSTGRES_DB="$PGDATABASE" \
    -e POSTGRES_USER="$PGUSER" \
    -p "${PGPORT}:5432" \
    "postgres:$PG_VERSION"

  info "Waiting for Postgres to be ready..."
  for i in $(seq 1 30); do
    docker exec "$CONTAINER_NAME" pg_isready -U "$PGUSER" -d "$PGDATABASE" &>/dev/null && break
    sleep 1
    [[ $i -eq 30 ]] && { error "Postgres did not start in 30 s"; docker rm -f "$CONTAINER_NAME"; exit 1; }
  done

  info "Installing pgTAP extension..."
  # supabase/postgres image bundles pgtap; for plain postgres we need to install
  docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$PGDATABASE" \
    -c "CREATE EXTENSION IF NOT EXISTS pgtap;" 2>/dev/null || {
    warn "pgTAP not bundled in image — trying to install via apt..."
    docker exec "$CONTAINER_NAME" bash -c \
      "apt-get update -qq && apt-get install -y -qq postgresql-${PG_VERSION}-pgtap 2>/dev/null" || {
      error "Cannot install pgTAP. Use the supabase/postgres image or install manually."
      docker rm -f "$CONTAINER_NAME"
      exit 1
    }
    docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$PGDATABASE" \
      -c "CREATE EXTENSION IF NOT EXISTS pgtap;"
  }

  info "Applying schema and migrations..."
  # Supabase auth schema stub — required because schema.sql references auth.users
  docker exec -i "$CONTAINER_NAME" psql -U "$PGUSER" -d "$PGDATABASE" <<'EOF'
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_user_meta_data JSONB
);
-- Stub for auth.uid() used in RLS policies
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT NULL::UUID; $$;
EOF

  # Apply main schema
  docker exec -i "$CONTAINER_NAME" psql -U "$PGUSER" -d "$PGDATABASE" < "$SCHEMA_FILE"

  # Apply all migrations in filename order
  for migration_file in \
    "$REPO_ROOT/supabase/migration-mvp.sql" \
    "$REPO_ROOT/supabase/migration-c2-c3-pin-bank.sql" \
    "$REPO_ROOT/supabase/migration-payment-methods-v1.sql" \
    "$REPO_ROOT/supabase/migration-profile-fields.sql"; do
    if [[ -f "$migration_file" ]]; then
      info "Applying $(basename "$migration_file")..."
      docker exec -i "$CONTAINER_NAME" psql -U "$PGUSER" -d "$PGDATABASE" < "$migration_file"
    fi
  done

  if ! command -v pg_prove &>/dev/null; then
    warn "pg_prove not found locally — running tests via psql inside Docker..."

    ALL_PASSED=true
    for test_file in "$TESTS_DIR"/0*.sql; do
      info "Running $(basename "$test_file")..."
      result=$(docker exec -i "$CONTAINER_NAME" psql -U "$PGUSER" -d "$PGDATABASE" \
        -v ON_ERROR_STOP=0 < "$test_file" 2>&1)
      echo "$result"
      if echo "$result" | grep -qE "^not ok"; then
        ALL_PASSED=false
      fi
    done

    docker rm -f "$CONTAINER_NAME" &>/dev/null || true

    if $ALL_PASSED; then
      info "All tests passed."
      exit 0
    else
      error "One or more tests FAILED."
      exit 1
    fi
  else
    info "Running pgTAP tests with pg_prove..."
    PGPASSWORD="$PGPASSWORD" pg_prove \
      --verbose \
      --recursive \
      --ext .sql \
      --host 127.0.0.1 \
      --port "$PGPORT" \
      --dbname "$PGDATABASE" \
      --username "$PGUSER" \
      "$TESTS_DIR"/0*.sql

    docker rm -f "$CONTAINER_NAME" &>/dev/null || true
  fi
}

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------
case "$MODE" in
  supabase) run_supabase_mode ;;
  docker)   run_docker_mode   ;;
  *)
    error "Unknown mode: $MODE"
    echo "Usage: $0 [--mode supabase|docker]"
    exit 1
    ;;
esac
