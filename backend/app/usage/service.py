"""Usage service — port of ``src/usage/usage.service.ts``."""
from ..common.utils import iso_now, utc_now
from ..db import supabase
from postgrest.exceptions import APIError


def _current_period_month() -> str:
    """Returns the first day of the current UTC month as 'YYYY-MM-01'."""
    now = utc_now()
    return f"{now.year}-{now.month:02d}-01"


class UsageService:
    def __init__(self) -> None:
        self.sb = supabase

    def get_current(self, user_id: str) -> dict:
        """Returns (or upserts) the usage_tracking row for the current month.
        The row is created with zeros if it doesn't yet exist.
        """
        period_month = _current_period_month()

        try:
            res = (
                self.sb.admin.from_("usage_tracking")
                .upsert(
                    {
                        "user_id": user_id,
                        "period_month": period_month,
                        "groups_created": 0,
                        "bills_created": 0,
                        "updated_at": iso_now(),
                    },
                    on_conflict="user_id,period_month",
                    ignore_duplicates=True,
                )
                .select()
                .single()
                .execute()
            )
            if res.data:
                return res.data
        except Exception:
            # ignoreDuplicates may return no data on conflict — fall through to select
            pass

        # Row already existed — fetch it
        res = (
            self.sb.admin.from_("usage_tracking")
            .select("*")
            .eq("user_id", user_id)
            .eq("period_month", period_month)
            .single()
            .execute()
        )
        return res.data

    def increment_groups(self, user_id: str) -> None:
        """Atomically increments groups_created for the current month.

        Strategy: upsert inserts a row with groups_created=1 when none exists;
        on conflict the RPC handles the increment atomically.
        Fallback: read-then-update if the RPC doesn't exist yet.
        """
        period_month = _current_period_month()

        # Step 1: ensure the row exists (noop if it does)
        try:
            self.sb.admin.from_("usage_tracking").upsert(
                {
                    "user_id": user_id,
                    "period_month": period_month,
                    "groups_created": 0,
                    "bills_created": 0,
                    "updated_at": iso_now(),
                },
                on_conflict="user_id,period_month",
                ignore_duplicates=True,
            ).execute()
        except Exception:
            pass

        # Step 2: increment via RPC; fallback to read-then-update
        try:
            self.sb.admin.rpc(
                "increment_usage_groups",
                {"p_user_id": user_id, "p_period_month": period_month},
            ).execute()
        except Exception:
            # Fallback if the RPC does not exist yet
            try:
                row_res = (
                    self.sb.admin.from_("usage_tracking")
                    .select("groups_created")
                    .eq("user_id", user_id)
                    .eq("period_month", period_month)
                    .single()
                    .execute()
                )
                row = row_res.data or {}
            except Exception:
                row = {}

            self.sb.admin.from_("usage_tracking").update(
                {
                    "groups_created": (row.get("groups_created") or 0) + 1,
                    "updated_at": iso_now(),
                }
            ).eq("user_id", user_id).eq("period_month", period_month).execute()

    def increment_bills(self, user_id: str) -> None:
        """Atomically increments bills_created for the current month.

        Called by BillsService after a successful bill insert.
        """
        period_month = _current_period_month()

        try:
            self.sb.admin.from_("usage_tracking").upsert(
                {
                    "user_id": user_id,
                    "period_month": period_month,
                    "groups_created": 0,
                    "bills_created": 0,
                    "updated_at": iso_now(),
                },
                on_conflict="user_id,period_month",
                ignore_duplicates=True,
            ).execute()
        except Exception:
            pass

        try:
            self.sb.admin.rpc(
                "increment_usage_bills",
                {"p_user_id": user_id, "p_period_month": period_month},
            ).execute()
        except Exception:
            # RPC not deployed yet — read-then-update fallback
            try:
                row_res = (
                    self.sb.admin.from_("usage_tracking")
                    .select("bills_created")
                    .eq("user_id", user_id)
                    .eq("period_month", period_month)
                    .single()
                    .execute()
                )
                row = row_res.data or {}
            except Exception:
                row = {}

            self.sb.admin.from_("usage_tracking").update(
                {
                    "bills_created": (row.get("bills_created") or 0) + 1,
                    "updated_at": iso_now(),
                }
            ).eq("user_id", user_id).eq("period_month", period_month).execute()

    def reset_month(self, now) -> None:
        """Month-reset placeholder — called by the nightly cron.
        No-op: usage_tracking uses (user_id, period_month) as the unique key.
        A new month's upsert will create a fresh row without touching prior months.
        """
        pass
