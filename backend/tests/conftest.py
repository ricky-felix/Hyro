"""Shared pytest fixtures — Python port of ``test/helpers/app.helper.ts``.

Strategy: import the real FastAPI app but swap the Supabase admin client for a
chainable in-memory fake so no live Supabase connection is required. The fake's
``auth.get_user`` maps known test tokens to fake users; every query builder
method returns ``self`` and ``.execute()`` resolves to a configurable response
(default ``data=None``), matching the behaviour of the original Jest mock.
"""
import os
from types import SimpleNamespace

import pytest

# Inject dummy env before any app module initialises (mirrors app.helper.ts).
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("XENDIT_WEBHOOK_TOKEN", "test-xendit-token")
os.environ.setdefault("MIDTRANS_SERVER_KEY", "test-midtrans-key")

FAKE_USER_ID = "aaaaaaaa-0000-0000-0000-000000000001"
FAKE_USER_EMAIL = "test@example.com"
FAKE_ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000002"
VALID_TOKEN = "valid-test-token"
ADMIN_TOKEN = "admin-test-token"


class FakeResponse:
    def __init__(self, data=None, count=0):
        self.data = data
        self.count = count


class FakeQuery:
    """Chainable query builder — every method returns self; execute() resolves."""

    _CHAIN = {
        "select", "eq", "neq", "in_", "is_", "gt", "lt", "gte", "lte",
        "order", "limit", "range", "or_", "filter", "not_", "match",
        "insert", "update", "delete", "upsert", "single", "maybe_single",
        "contains", "overlaps", "like", "ilike", "text_search",
    }

    def __init__(self, client):
        self._client = client

    def __getattr__(self, name):
        if name in FakeQuery._CHAIN:
            def _chain(*args, **kwargs):
                return self
            return _chain
        raise AttributeError(name)

    def execute(self):
        return self._client._next_response()


class FakeStorageBucket:
    def create_signed_upload_url(self, path):
        return {"signed_url": "https://example.com/upload", "path": path, "token": "tok"}

    def create_signed_url(self, path, expires_in):
        return {"signedUrl": "https://example.com/read"}

    def remove(self, paths):
        return {"data": {}, "error": None}


class FakeStorage:
    def from_(self, bucket):
        return FakeStorageBucket()


class FakeAuth:
    def get_user(self, token):
        if token == VALID_TOKEN:
            return SimpleNamespace(
                user=SimpleNamespace(id=FAKE_USER_ID, email=FAKE_USER_EMAIL)
            )
        if token == ADMIN_TOKEN:
            return SimpleNamespace(
                user=SimpleNamespace(id=FAKE_ADMIN_ID, email="admin@example.com")
            )
        raise Exception("invalid token")


class FakeAdminClient:
    """Stand-in for a supabase-py Client.

    Tests may set ``default_data`` / ``default_count`` to control query results,
    or ``role_for`` to control the platform_role resolved by the auth guard.
    """

    def __init__(self):
        self.default_data = None
        self.default_count = 0
        self.auth = FakeAuth()
        self.storage = FakeStorage()

    def from_(self, table):
        return FakeQuery(self)

    def table(self, table):
        return FakeQuery(self)

    def rpc(self, name, params=None):
        return FakeQuery(self)

    def _next_response(self):
        return FakeResponse(self.default_data, self.default_count)


@pytest.fixture()
def fake_admin():
    """Install a fresh fake admin client onto the Supabase singleton."""
    from app.db import supabase

    fake = FakeAdminClient()
    previous = supabase._admin
    supabase._admin = fake
    yield fake
    supabase._admin = previous


@pytest.fixture()
def client(fake_admin):
    """A FastAPI TestClient wired to the fake Supabase admin client.

    Note: constructed WITHOUT the context-manager form so the lifespan (and thus
    the APScheduler background jobs) does not start during tests.
    """
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


@pytest.fixture()
def auth_headers():
    return {"Authorization": f"Bearer {VALID_TOKEN}"}


@pytest.fixture()
def admin_headers():
    return {"Authorization": f"Bearer {ADMIN_TOKEN}"}
