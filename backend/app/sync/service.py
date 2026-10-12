"""Sync service — powers the offline-first client's incremental pull.

The client caches five tables locally (groups, group_members, rounds,
payments, notifications) and persists a single cursor: the ``server_time``
returned by its last successful pull. Every subsequent pull asks "what
changed since then" using each table's ``updated_at`` column (see
``supabase/migration-offline-sync.sql``) — never a client-supplied clock.

This intentionally does not handle row deletions beyond group membership:
``group_ids`` is always the full, current list of groups the user belongs
to, so the client can prune any locally-cached group that's no longer in
that list (e.g. removed from the group, or the group was deleted). Deletions
of individual rounds/payments/notifications are not expected in normal
product flow and are out of scope for v1.
"""
from typing import Optional

from ..db import fetch_all, supabase


class SyncService:
    def __init__(self) -> None:
        self.sb = supabase

    def pull(self, user_id: str, since: Optional[str]) -> dict:
        from ..common.utils import iso_now

        server_time = iso_now()
        group_ids = self._group_ids_for_user(user_id)

        groups = self._select_changed("groups", "id", group_ids, since)
        group_members = self._select_changed("group_members", "group_id", group_ids, since)
        rounds = self._select_changed("rounds", "group_id", group_ids, since)
        payments = self._select_changed("payments", "group_id", group_ids, since)

        notif_query = self.sb.admin.from_("notifications").select("*").eq("user_id", user_id)
        if since:
            notif_query = notif_query.gt("updated_at", since)
        notifications = notif_query.execute().data or []

        return {
            "server_time": server_time,
            "group_ids": group_ids,
            "groups": groups,
            "group_members": group_members,
            "rounds": rounds,
            "payments": payments,
            "notifications": notifications,
        }

    def _select_changed(
        self, table: str, scope_column: str, scope_values: list[str], since: Optional[str]
    ) -> list:
        if not scope_values:
            return []
        query = self.sb.admin.from_(table).select("*").in_(scope_column, scope_values)
        if since:
            query = query.gt("updated_at", since)
        return query.execute().data or []

    def _group_ids_for_user(self, user_id: str) -> list:
        rows = fetch_all(
            self.sb.admin.from_("group_members").select("group_id").eq("user_id", user_id)
        )
        return [r["group_id"] for r in rows]
