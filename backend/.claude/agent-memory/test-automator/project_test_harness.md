---
name: project-test-harness
description: FastAPI e2e test harness location, fixtures, and run command for the Arisan Digital backend
metadata:
  type: project
---

Pytest harness lives at `tests/conftest.py`. It patches the Supabase admin client with `FakeAdminClient` and provides four fixtures: `client` (TestClient), `auth_headers`, `admin_headers`, `fake_admin`. Importable constants: `VALID_TOKEN`, `ADMIN_TOKEN`, `FAKE_USER_ID`, `FAKE_ADMIN_ID`.

Run all e2e tests: `cd /Users/rickyfelix/Arisan-Digital/backend && ./.venv/bin/python -m pytest tests/e2e/ -q`

**Why:** The harness is designed to be used as-is; new test files just import fixtures as function params — no extra setup needed.

**How to apply:** When writing new e2e tests, accept `client`, `auth_headers`, `admin_headers`, `fake_admin` as pytest function params. Use `fake_admin.default_data = [...]` or `fake_admin.default_count = N` to control query return values.

Completed ports (45 tests, 0.45 s):
- `tests/e2e/test_core_app.py` — health, auth guard, validation parity, webhook signatures
- `tests/e2e/test_bills.py` — 12 tests
- `tests/e2e/test_bill_participants.py` — 4 tests
- `tests/e2e/test_invite_links.py` — 10 tests
- `tests/e2e/test_notifications.py` — 8 tests
- `tests/e2e/test_payments.py` — 11 tests

Related: [[project-fastapi-routes]]
