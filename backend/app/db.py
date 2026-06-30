"""Supabase access layer.

Port of ``src/supabase/supabase.service.ts``. Exposes a lazily-created
service-role admin client, a per-user (RLS-respecting) client factory, and a
token verification helper. Also provides small query helpers that reproduce the
``{ data, error }`` ergonomics of supabase-js for ``.single()`` / ``.maybe_single()``.
"""
from functools import lru_cache
from typing import Any, Optional

from postgrest.exceptions import APIError
from supabase import Client, create_client

from .config import settings


class SupabaseService:
    """Singleton wrapper around the Supabase admin + per-user clients."""

    def __init__(self) -> None:
        self._admin: Optional[Client] = None

    @property
    def admin(self) -> Client:
        if self._admin is None:
            self._admin = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_SERVICE_ROLE_KEY,
            )
        return self._admin

    def for_user(self, access_token: str) -> Client:
        """Returns a client that honours row-level security for the given JWT."""
        client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,
        )
        client.postgrest.auth(access_token)
        return client

    def verify_token(self, token: str):
        """Verifies a Supabase access token and returns the auth user.

        Raises ``APIError`` / ``AuthError`` when the token is invalid.
        """
        response = self.admin.auth.get_user(token)
        return response.user


@lru_cache
def get_supabase() -> SupabaseService:
    return SupabaseService()


supabase = get_supabase()


# ─────────────────────────────────────────────────
# Query helpers — reproduce supabase-js single/maybeSingle semantics
# ─────────────────────────────────────────────────
# PostgREST returns this error code when ``.single()``/``.maybe_single()`` find
# zero (or multiple) rows.
_NO_ROWS_CODE = "PGRST116"


def maybe_single(builder) -> Optional[dict]:
    """Run a query expecting at most one row. Returns the row dict or ``None``.

    Equivalent to supabase-js ``.maybeSingle()`` — an empty result is *not* an
    error.
    """
    try:
        res = builder.maybe_single().execute()
    except APIError as exc:
        if getattr(exc, "code", None) == _NO_ROWS_CODE:
            return None
        raise
    return res.data if res else None


def fetch_one(builder) -> dict:
    """Run a query expecting exactly one row. Returns the row dict.

    Equivalent to supabase-js ``.single()``. Raises ``APIError`` when no row is
    found — callers that need a 404 should use :func:`maybe_single` and raise
    ``HTTPException`` themselves, mirroring the original services.
    """
    return builder.single().execute().data


def fetch_all(builder) -> list:
    """Run a list query and return the rows (possibly empty)."""
    res = builder.execute()
    return res.data or []
