"""Subscriptions service — port of ``src/subscriptions/subscriptions.service.ts``."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from ..common.utils import iso_now, iso, utc_now
from ..db import fetch_all, maybe_single, supabase
from ..payment_transactions.service import PaymentTransactionsService
from .schemas import CancelSubscriptionDto, CreateGroupSubscriptionDto, CreateUserSubscriptionDto


def _compute_period_end(billing_cycle: str) -> datetime:
    """Compute the period-end datetime from now based on billing cycle.
    Mirrors JS: new Date(); end.setFullYear/setMonth.
    """
    now = utc_now()
    if billing_cycle == "yearly":
        # Add one year — replace year, handling leap year edge case
        try:
            end = now.replace(year=now.year + 1)
        except ValueError:
            # Feb 29 on a non-leap year: roll to Mar 1
            end = now.replace(year=now.year + 1, month=3, day=1)
    else:
        # Add one month
        month = now.month + 1
        year = now.year
        if month > 12:
            month = 1
            year += 1
        # Handle day overflow (e.g. Jan 31 → Feb 28)
        import calendar
        last_day = calendar.monthrange(year, month)[1]
        day = min(now.day, last_day)
        end = now.replace(year=year, month=month, day=day)
    return end


class SubscriptionsService:
    def __init__(self) -> None:
        self.sb = supabase
        self.tx_service = PaymentTransactionsService()

    # ────────────────────────────────────────────────────────────────────
    # USER SUBSCRIPTIONS
    # ────────────────────────────────────────────────────────────────────

    def get_active_for_user(self, user_id: str) -> Optional[dict]:
        """Returns the user's active subscription joined to the plan, or None if on free."""
        return maybe_single(
            self.sb.admin.from_("user_subscriptions")
            .select("*, plans(*)")
            .eq("user_id", user_id)
            .eq("status", "active")
        )

    def create_user_subscription(
        self, dto: CreateUserSubscriptionDto, user_id: str
    ) -> dict:
        """Creates a user subscription.
        - Throws 409 if the user already has an active subscription.
        - Inserts a payment_transactions row of type='subscription_new'.
        - Sets status='active' immediately (gateway webhook will update if needed).
        """
        existing = self.get_active_for_user(user_id)
        if existing:
            raise HTTPException(
                409,
                "User already has an active subscription. Cancel it before subscribing to a new plan.",
            )

        plan = self._resolve_plan_by_slug(dto.plan_slug)

        now = utc_now()
        period_end = _compute_period_end(dto.billing_cycle)
        gateway = dto.gateway if dto.gateway else "manual"

        res = (
            self.sb.admin.from_("user_subscriptions")
            .insert(
                {
                    "user_id": user_id,
                    "plan_id": plan["id"],
                    "billing_cycle": dto.billing_cycle,
                    "status": "active",
                    "payment_ref": dto.payment_ref if dto.payment_ref else None,
                    "gateway": gateway,
                    "started_at": iso(now),
                    "current_period_start": iso(now),
                    "current_period_end": iso(period_end),
                }
            )
            .execute()
        )
        sub = res.data[0]

        amount = plan["price_yearly"] if dto.billing_cycle == "yearly" else plan["price_monthly"]
        self.tx_service.record(
            {
                "user_id": user_id,
                "type": "subscription_new",
                "gateway": gateway,
                "amount": amount,
                "subscription_id": sub["id"],
                "gateway_tx_id": dto.payment_ref if dto.payment_ref else None,
                "status": "paid" if gateway == "manual" else "pending",
                "paid_at": iso(now) if gateway == "manual" else None,
            }
        )

        return sub

    def cancel(self, user_id: str, dto: Optional[CancelSubscriptionDto] = None) -> dict:
        """Cancels the authenticated user's active subscription.
        Sets status='cancelled' and records cancelled_at.
        """
        existing = self.get_active_for_user(user_id)
        if not existing:
            raise HTTPException(404, "No active subscription found for this user.")

        res = (
            self.sb.admin.from_("user_subscriptions")
            .update(
                {
                    "status": "cancelled",
                    "cancelled_at": iso_now(),
                }
            )
            .eq("id", existing["id"])
            .execute()
        )
        return res.data[0]

    def expire_due(self, now) -> dict:
        """Finds active subscriptions past their current_period_end and marks them expired.
        Intended for nightly cron job use.

        Args:
            now: Reference time — rows where current_period_end < now are expired.
        Returns:
            {"expired_count": int}
        """
        iso_now_str = iso(now) if isinstance(now, datetime) else now

        user_res = (
            self.sb.admin.from_("user_subscriptions")
            .update({"status": "expired"})
            .eq("status", "active")
            .lt("current_period_end", iso_now_str)
            .execute()
        )
        user_subs = user_res.data or []

        group_res = (
            self.sb.admin.from_("group_subscriptions")
            .update({"status": "expired"})
            .eq("status", "active")
            .lt("current_period_end", iso_now_str)
            .execute()
        )
        group_subs = group_res.data or []

        expired_count = len(user_subs) + len(group_subs)
        return {"expired_count": expired_count}

    # ────────────────────────────────────────────────────────────────────
    # GROUP SUBSCRIPTIONS
    # ────────────────────────────────────────────────────────────────────

    def get_active_for_group(self, group_id: str) -> Optional[dict]:
        """Returns the group's active subscription joined to the plan, or None if on free."""
        return maybe_single(
            self.sb.admin.from_("group_subscriptions")
            .select("*, plans(*)")
            .eq("group_id", group_id)
            .eq("status", "active")
        )

    def create_group_subscription(
        self, dto: CreateGroupSubscriptionDto, user_id: str
    ) -> dict:
        """Creates a group subscription. Only the group admin may do this.
        - Validates that the calling user is admin_id of the group.
        - Throws 409 if the group already has an active subscription.
        """
        self._assert_group_admin(dto.group_id, user_id)

        existing = self.get_active_for_group(dto.group_id)
        if existing:
            raise HTTPException(
                409,
                "This group already has an active subscription. Cancel it before subscribing to a new plan.",
            )

        plan = self._resolve_plan_by_slug(dto.plan_slug)

        now = utc_now()
        period_end = _compute_period_end(dto.billing_cycle)
        gateway = dto.gateway if dto.gateway else "manual"

        res = (
            self.sb.admin.from_("group_subscriptions")
            .insert(
                {
                    "group_id": dto.group_id,
                    "paid_by": user_id,
                    "plan_id": plan["id"],
                    "billing_cycle": dto.billing_cycle,
                    "status": "active",
                    "payment_ref": dto.payment_ref if dto.payment_ref else None,
                    "gateway": gateway,
                    "started_at": iso(now),
                    "current_period_end": iso(period_end),
                }
            )
            .execute()
        )
        sub = res.data[0]

        amount = plan["price_yearly"] if dto.billing_cycle == "yearly" else plan["price_monthly"]
        self.tx_service.record(
            {
                "user_id": user_id,
                "type": "subscription_new",
                "gateway": gateway,
                "amount": amount,
                "group_subscription_id": sub["id"],
                "gateway_tx_id": dto.payment_ref if dto.payment_ref else None,
                "status": "paid" if gateway == "manual" else "pending",
                "paid_at": iso(now) if gateway == "manual" else None,
            }
        )

        return sub

    def cancel_group(
        self, group_id: str, user_id: str, dto: Optional[CancelSubscriptionDto] = None
    ) -> dict:
        """Cancels the group's active subscription. Only the group admin may cancel."""
        self._assert_group_admin(group_id, user_id)

        existing = self.get_active_for_group(group_id)
        if not existing:
            raise HTTPException(404, f"No active subscription found for group {group_id}.")

        res = (
            self.sb.admin.from_("group_subscriptions")
            .update(
                {
                    "status": "cancelled",
                    "cancelled_at": iso_now(),
                }
            )
            .eq("id", existing["id"])
            .execute()
        )
        return res.data[0]

    # ────────────────────────────────────────────────────────────────────
    # HELPERS (required cross-module contracts)
    # ────────────────────────────────────────────────────────────────────

    def activate_and_extend_user_sub(self, sub_id: str, billing_cycle: str) -> dict:
        """Extends the current_period_end for a user subscription after a confirmed payment.
        Called by BillingService during webhook reconciliation.
        """
        now = utc_now()
        period_end = _compute_period_end(billing_cycle)

        res = (
            self.sb.admin.from_("user_subscriptions")
            .update(
                {
                    "status": "active",
                    "current_period_start": iso(now),
                    "current_period_end": iso(period_end),
                }
            )
            .eq("id", sub_id)
            .execute()
        )
        return res.data[0] if res.data else {}

    def activate_and_extend_group_sub(self, group_sub_id: str, billing_cycle: str) -> dict:
        """Extends the current_period_end for a group subscription after a confirmed payment.
        Called by BillingService during webhook reconciliation.
        """
        period_end = _compute_period_end(billing_cycle)

        res = (
            self.sb.admin.from_("group_subscriptions")
            .update(
                {
                    "status": "active",
                    "current_period_end": iso(period_end),
                }
            )
            .eq("id", group_sub_id)
            .execute()
        )
        return res.data[0] if res.data else {}

    # ────────────────────────────────────────────────────────────────────
    # PRIVATE HELPERS
    # ────────────────────────────────────────────────────────────────────

    def _resolve_plan_by_slug(self, slug: str) -> dict:
        data = maybe_single(
            self.sb.admin.from_("plans")
            .select("id, price_monthly, price_yearly, is_active")
            .eq("slug", slug)
        )
        if not data:
            raise HTTPException(404, f"Plan '{slug}' not found")
        if not data.get("is_active"):
            raise HTTPException(403, f"Plan '{slug}' is no longer available")
        return data

    def _assert_group_admin(self, group_id: str, user_id: str) -> None:
        group = maybe_single(
            self.sb.admin.from_("groups").select("admin_id").eq("id", group_id)
        )
        if not group:
            raise HTTPException(404, f"Group {group_id} not found")
        if group["admin_id"] != user_id:
            raise HTTPException(403, "Only the group admin can manage the group subscription")
