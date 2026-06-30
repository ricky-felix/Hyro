"""Payment transactions service — port of ``src/payment-transactions/payment-transactions.service.ts``."""
from typing import Optional

from fastapi import HTTPException

from ..common.types import Gateway, TransactionStatus, TransactionType
from ..common.utils import iso_now
from ..db import fetch_all, maybe_single, supabase


class PaymentTransactionsService:
    def __init__(self) -> None:
        self.sb = supabase

    def record(self, input: dict) -> dict:
        """Records a new payment transaction row.
        Called internally by SubscriptionsService and webhook handlers.

        Expected input keys: user_id, type, gateway, amount, and optionally:
        subscription_id, group_subscription_id, gateway_tx_id, gateway_status,
        currency, status, gateway_payload, paid_at.
        """
        res = (
            self.sb.admin.from_("payment_transactions")
            .insert(
                {
                    "user_id": input["user_id"],
                    "type": input["type"],
                    "gateway": input["gateway"],
                    "amount": input["amount"],
                    "subscription_id": input.get("subscription_id"),
                    "group_subscription_id": input.get("group_subscription_id"),
                    "gateway_tx_id": input.get("gateway_tx_id"),
                    "gateway_status": input.get("gateway_status"),
                    "currency": input.get("currency", "IDR"),
                    "status": input.get("status", "pending"),
                    "gateway_payload": input.get("gateway_payload"),
                    "paid_at": input.get("paid_at"),
                }
            )
            .execute()
        )
        return res.data[0]

    def update_by_gateway_tx_id(
        self, gateway_tx_id: str, patch: dict
    ) -> Optional[dict]:
        """Idempotent update by gateway_tx_id.
        Webhook handlers may retry — safe to call multiple times with the same data.
        Returns None if no matching transaction is found (caller may skip reconciliation).
        """
        existing = maybe_single(
            self.sb.admin.from_("payment_transactions")
            .select("id, status")
            .eq("gateway_tx_id", gateway_tx_id)
        )
        if not existing:
            return None  # Unknown tx — let caller decide

        update_payload: dict = {"updated_at": iso_now()}
        if "status" in patch and patch["status"] is not None:
            update_payload["status"] = patch["status"]
        if "paid_at" in patch:
            update_payload["paid_at"] = patch["paid_at"]
        if "gateway_status" in patch and patch["gateway_status"] is not None:
            update_payload["gateway_status"] = patch["gateway_status"]
        if "gateway_payload" in patch and patch["gateway_payload"] is not None:
            update_payload["gateway_payload"] = patch["gateway_payload"]

        res = (
            self.sb.admin.from_("payment_transactions")
            .update(update_payload)
            .eq("id", existing["id"])
            .execute()
        )
        return res.data[0] if res.data else None

    def find_by_id(self, id: str) -> dict:
        """Retrieves a transaction by its internal ID."""
        data = maybe_single(
            self.sb.admin.from_("payment_transactions")
            .select("*")
            .eq("id", id)
        )
        if not data:
            raise HTTPException(404, f"Transaction {id} not found")
        return data

    def find_by_gateway_tx_id(self, gateway_tx_id: str) -> Optional[dict]:
        """Retrieves a transaction by its gateway_tx_id.
        Returns None if not found — caller handles.
        """
        return maybe_single(
            self.sb.admin.from_("payment_transactions")
            .select("*")
            .eq("gateway_tx_id", gateway_tx_id)
        )

    def list_mine(self, user_id: str) -> list:
        """Lists all transactions for the authenticated user, newest first."""
        return fetch_all(
            self.sb.admin.from_("payment_transactions")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
        )

    def list_all(
        self,
        status: Optional[TransactionStatus] = None,
        gateway: Optional[Gateway] = None,
        type: Optional[TransactionType] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> list:
        """Lists all transactions across all users — super_admin only."""
        q = (
            self.sb.admin.from_("payment_transactions")
            .select("*, users(id, name, email)")
            .order("created_at", desc=True)
        )

        if status:
            q = q.eq("status", status)
        if gateway:
            q = q.eq("gateway", gateway)
        if type:
            q = q.eq("type", type)

        _limit = limit if limit is not None else 50
        _offset = offset if offset is not None else 0
        q = q.range(_offset, _offset + _limit - 1)

        return fetch_all(q)
