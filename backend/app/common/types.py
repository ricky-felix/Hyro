"""Shared domain types — mirror of ``supabase/schema.sql`` and
``src/common/types/schema.types.ts``. Keep in sync when migrating.
"""
from typing import Literal, Optional

from pydantic import BaseModel

PlatformRole = Literal["user", "super_admin"]
GroupRole = Literal["member", "admin"]
Frequency = Literal["weekly", "monthly"]
GiliranMethod = Literal["random", "manual"]
GroupStatus = Literal["active", "completed", "pending"]
RoundStatus = Literal["upcoming", "active", "completed"]
PaymentStatus = Literal["pending", "confirmed", "rejected"]
Language = Literal["id", "en"]

BillCategory = Literal[
    "food",
    "transport",
    "accommodation",
    "utilities",
    "entertainment",
    "shopping",
    "other",
]

SplitMethod = Literal["equal", "exact", "percentage", "shares"]
BillStatus = Literal["open", "settled"]
SettlementStatus = Literal["pending", "confirmed", "rejected"]
RecurringFrequency = Literal["weekly", "monthly", "yearly"]
DebtStatus = Literal["pending", "settled", "dismissed"]

PlanSlug = Literal["free", "boss", "business"]
BillingCycle = Literal["monthly", "yearly"]
SubscriptionStatus = Literal["active", "cancelled", "expired", "past_due"]
Gateway = Literal["xendit", "midtrans", "manual"]
TransactionType = Literal[
    "subscription_new",
    "subscription_renewal",
    "subscription_upgrade",
    "in_app_payment",
]
TransactionStatus = Literal[
    "pending",
    "paid",
    "failed",
    "refunded",
    "expired",
]

NotificationType = Literal[
    "payment_due",
    "payment_confirmed",
    "payment_rejected",
    "giliran_announced",
    "member_joined",
    "round_completed",
    "bill_created",
    "bill_settled",
    "bill_reminder",
    "settlement_confirmed",
    "settlement_rejected",
]


class AuthUser(BaseModel):
    id: str
    email: Optional[str] = None
    platform_role: PlatformRole = "user"


# ─────────────────────────────────────────────────
# PAYMENT METHODS (v1 JSONB object shape)
# ─────────────────────────────────────────────────
# NOTE: only e-wallets are supported for now. Bank transfer and QRIS are
# deferred. The account_number/holder_name/qris_image_path fields stay in the
# shape so either can be re-added without a data migration.
PaymentMethodType = Literal["gopay", "ovo", "dana", "shopeepay", "linkaja"]
