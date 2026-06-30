"""Notifications service — port of ``src/notifications/notifications.service.ts``."""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException

from ..db import maybe_single, supabase

logger = logging.getLogger(__name__)

# How far back we look when deduplicating reminders (24 h), mirroring TS constant.
REMINDER_DEDUP_WINDOW_SECONDS = 24 * 60 * 60


class NotificationsService:
    def __init__(self) -> None:
        self.sb = supabase

    # ─────────────────────────────────────────────────────────────────────────
    # Core create helpers
    # ─────────────────────────────────────────────────────────────────────────

    def create(self, item: dict) -> Optional[dict]:
        """Insert a single notification row. Notification failures must never
        crash the caller — logs and returns None on error."""
        try:
            res = (
                self.sb.admin.from_("notifications")
                .insert(
                    {
                        "user_id": item["user_id"],
                        "type": item["type"],
                        "title": item["title"],
                        "body": item["body"],
                        "metadata": item.get("metadata") or None,
                        "is_read": False,
                    }
                )
                .execute()
            )
            return res.data[0] if res.data else None
        except Exception as exc:
            logger.error("[NotificationsService] Failed to insert notification: %s", exc)
            return None

    def create_many(self, items: list[dict]) -> None:
        """Bulk-insert notifications — one row per item.
        Mirrors TS ``createMany`` which uses ``Promise.allSettled`` so that one
        bad user_id does not block the rest.  Ignores individual failures."""
        for item in items:
            self.create(item)

    # ─────────────────────────────────────────────────────────────────────────
    # List / read-state methods (controller-facing)
    # ─────────────────────────────────────────────────────────────────────────

    def list_mine(self, user_id: str, limit: int = 20, offset: int = 0) -> list:
        """Return the caller's notifications, newest first, paginated."""
        res = (
            self.sb.admin.from_("notifications")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return res.data or []

    def unread_count(self, user_id: str) -> dict:
        """Return ``{"count": int}`` for unread notifications."""
        res = (
            self.sb.admin.from_("notifications")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("is_read", False)
            .execute()
        )
        return {"count": res.count if res.count is not None else 0}

    def mark_read(self, notification_id: str, user_id: str) -> dict:
        """Mark a single notification as read; raises 404 if not found or not owned."""
        existing = maybe_single(
            self.sb.admin.from_("notifications")
            .select("id, user_id")
            .eq("id", notification_id)
        )
        if not existing or existing["user_id"] != user_id:
            raise HTTPException(404, f"Notification {notification_id} not found")

        res = (
            self.sb.admin.from_("notifications")
            .update({"is_read": True})
            .eq("id", notification_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(404, f"Notification {notification_id} not found")
        return res.data[0]

    def mark_all_read(self, user_id: str) -> dict:
        """Mark all unread notifications for the user as read."""
        self.sb.admin.from_("notifications").update({"is_read": True}).eq(
            "user_id", user_id
        ).eq("is_read", False).execute()
        return {"message": "All notifications marked as read"}

    # ─────────────────────────────────────────────────────────────────────────
    # Scheduler: payment-reminder batch job
    # ─────────────────────────────────────────────────────────────────────────

    def create_payment_reminders(self, now: datetime) -> dict:
        """Find upcoming/overdue obligations and create reminder notifications.

        Arisan: for every round in status 'upcoming' or 'active' whose
          scheduled_date <= now + 24 h, notify each group member who does NOT
          yet have a confirmed payment for that round.

        Patungan: for every bill_settlements row with status='pending', notify
          the payer that a settlement is outstanding.

        Idempotency: guards against duplicates by querying for an existing
          notification with the same (user_id, type, metadata key) created
          within the last 24 hours.

        Returns ``{"created": int}``.
        """
        dedup_cutoff = (
            now - timedelta(seconds=REMINDER_DEDUP_WINDOW_SECONDS)
        ).isoformat()
        created = 0

        # ── 1. Arisan: rounds due within the next 24 h or already overdue ──
        lookahead_date = (now + timedelta(seconds=REMINDER_DEDUP_WINDOW_SECONDS)).date().isoformat()
        now_date = now.date().isoformat()

        try:
            rounds_res = (
                self.sb.admin.from_("rounds")
                .select("id, group_id, round_number, scheduled_date")
                .in_("status", ["upcoming", "active"])
                .lte("scheduled_date", lookahead_date)
                .execute()
            )
            due_rounds = rounds_res.data or []
        except Exception as exc:
            logger.error("create_payment_reminders: failed to fetch due rounds: %s", exc)
            due_rounds = []

        for round_ in due_rounds:
            # All members of this group
            try:
                members_res = (
                    self.sb.admin.from_("group_members")
                    .select("user_id")
                    .eq("group_id", round_["group_id"])
                    .execute()
                )
                members = members_res.data or []
            except Exception as exc:
                logger.warning(
                    "create_payment_reminders: could not fetch members for group %s: %s",
                    round_["group_id"],
                    exc,
                )
                continue

            # Members who have already paid (confirmed) this round
            try:
                payments_res = (
                    self.sb.admin.from_("payments")
                    .select("payer_id")
                    .eq("round_id", round_["id"])
                    .eq("status", "confirmed")
                    .execute()
                )
                confirmed_payments = payments_res.data or []
            except Exception as exc:
                logger.warning(
                    "create_payment_reminders: could not fetch payments for round %s: %s",
                    round_["id"],
                    exc,
                )
                continue

            paid_user_ids = {p["payer_id"] for p in confirmed_payments}

            is_overdue = round_["scheduled_date"] < now_date
            title = (
                "Iuran Arisan Telat!"
                if is_overdue
                else "Iuran Arisan Jatuh Tempo Besok"
            )

            for member in members:
                if member["user_id"] in paid_user_ids:
                    continue  # already paid

                # Dedup: skip if a payment_due reminder for this round was sent
                # within the last 24 h
                existing = maybe_single(
                    self.sb.admin.from_("notifications")
                    .select("id")
                    .eq("user_id", member["user_id"])
                    .eq("type", "payment_due")
                    .gte("created_at", dedup_cutoff)
                    .contains("metadata", {"round_id": round_["id"]})
                )
                if existing:
                    continue

                body = (
                    f"Iuran kamu untuk Putaran #{round_['round_number']} sudah melewati "
                    f"tanggal jatuh tempo ({round_['scheduled_date']}). Segera bayar!"
                    if is_overdue
                    else f"Iuran kamu untuk Putaran #{round_['round_number']} jatuh tempo "
                    f"besok ({round_['scheduled_date']}). Jangan lupa bayar!"
                )

                result = self.create(
                    {
                        "user_id": member["user_id"],
                        "type": "payment_due",
                        "title": title,
                        "body": body,
                        "metadata": {
                            "group_id": round_["group_id"],
                            "round_id": round_["id"],
                            "round_number": round_["round_number"],
                            "scheduled_date": round_["scheduled_date"],
                            "is_overdue": is_overdue,
                        },
                    }
                )
                if result:
                    created += 1

        # ── 2. Patungan: pending bill settlements ────────────────────────────
        try:
            settlements_res = (
                self.sb.admin.from_("bill_settlements")
                .select("id, bill_id, payer_id, amount")
                .eq("status", "pending")
                .execute()
            )
            pending_settlements = settlements_res.data or []
        except Exception as exc:
            logger.error(
                "create_payment_reminders: failed to fetch pending settlements: %s", exc
            )
            pending_settlements = []

        for settlement in pending_settlements:
            # Dedup: skip if a bill_reminder for this settlement was sent in
            # the last 24 h
            existing = maybe_single(
                self.sb.admin.from_("notifications")
                .select("id")
                .eq("user_id", settlement["payer_id"])
                .eq("type", "bill_reminder")
                .gte("created_at", dedup_cutoff)
                .contains("metadata", {"settlement_id": settlement["id"]})
            )
            if existing:
                continue

            # Format amount in Indonesian locale style (no locale module needed)
            amount_str = f"{int(settlement['amount']):,}".replace(",", ".")
            result = self.create(
                {
                    "user_id": settlement["payer_id"],
                    "type": "bill_reminder",
                    "title": "Tagihan Patungan Menunggu",
                    "body": (
                        f"Kamu masih punya tagihan patungan sebesar Rp {amount_str} "
                        "yang belum diselesaikan. Yuk, segera bayar!"
                    ),
                    "metadata": {
                        "bill_id": settlement["bill_id"],
                        "settlement_id": settlement["id"],
                        "amount": settlement["amount"],
                    },
                }
            )
            if result:
                created += 1

        return {"created": created}
