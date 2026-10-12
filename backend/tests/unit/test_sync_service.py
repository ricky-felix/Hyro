"""Unit tests for SyncService.pull — the offline client's incremental pull.

Verifies the response shape, that queries are scoped to the user's groups,
and that the no-groups-yet case short-circuits without querying tables that
would otherwise need an empty `IN ()` (which some drivers choke on).
"""
from app.db import supabase as sb_singleton
from app.sync.service import SyncService

from _fake_seq import install


def test_pull_scopes_to_users_groups_and_returns_all_tables():
    previous, fake = install(
        sb_singleton,
        [
            ("group_members", [{"group_id": "g1"}]),  # membership → group_ids
            ("groups", [{"id": "g1", "name": "A"}]),
            ("group_members", [{"group_id": "g1", "user_id": "u1"}]),
            ("rounds", [{"id": "r1", "group_id": "g1"}]),
            ("payments", [{"id": "p1", "group_id": "g1"}]),
            ("notifications", [{"id": "n1", "user_id": "u1"}]),
        ],
    )
    try:
        svc = SyncService()
        result = svc.pull("u1", since=None)

        assert result["group_ids"] == ["g1"]
        assert result["groups"] == [{"id": "g1", "name": "A"}]
        assert result["group_members"] == [{"group_id": "g1", "user_id": "u1"}]
        assert result["rounds"] == [{"id": "r1", "group_id": "g1"}]
        assert result["payments"] == [{"id": "p1", "group_id": "g1"}]
        assert result["notifications"] == [{"id": "n1", "user_id": "u1"}]
        assert isinstance(result["server_time"], str) and result["server_time"]
        fake.assert_exhausted()
    finally:
        sb_singleton._admin = previous


def test_pull_with_no_groups_skips_group_scoped_queries():
    """A brand-new user with zero groups must not trigger scoped queries
    against groups/group_members/rounds/payments — only the membership
    lookup and their own notifications are queried."""
    previous, fake = install(
        sb_singleton,
        [
            ("group_members", []),
            ("notifications", []),
        ],
    )
    try:
        svc = SyncService()
        result = svc.pull("u1", since=None)

        assert result["group_ids"] == []
        assert result["groups"] == []
        assert result["group_members"] == []
        assert result["rounds"] == []
        assert result["payments"] == []
        assert result["notifications"] == []
        fake.assert_exhausted()
    finally:
        sb_singleton._admin = previous
