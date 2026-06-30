"""Billing service — port of ``src/billing/billing.service.ts``."""
import logging
from typing import Optional

from ..db import maybe_single, supabase
from ..payment_transactions.service import PaymentTransactionsService
from ..subscriptions.service import SubscriptionsService

logger = logging.getLogger(__name__)

_SUBSCRIPTION_TYPES = {
    "subscription_new",
    "subscription_renewal",
    "subscription_upgrade",
}


class BillingService:
    def __init__(self) -> None:
        self.sb = supabase
        self.tx_service = PaymentTransactionsService()
        self.subscriptions_service = SubscriptionsService()

    def reconcile(self, input: dict) -> None:
        """Central reconciliation logic called by both Xendit and Midtrans webhook controllers.

        Steps:
          1. Update payment_transactions row with the new status.
          2. If payment is now 'paid' and the transaction is a subscription type,
             activate/extend the linked user_subscriptions or group_subscriptions row.

        This method is idempotent — calling it multiple times with the same
        gateway_tx_id is safe.

        Expected input keys: gateway_tx_id, status, gateway_status, gateway_payload, paid_at.
        """
        gateway_tx_id = input["gateway_tx_id"]
        status = input["status"]
        gateway_status = input["gateway_status"]
        gateway_payload = input["gateway_payload"]
        paid_at = input.get("paid_at")

        # Step 1: Update the transaction ledger row
        tx = self.tx_service.update_by_gateway_tx_id(
            gateway_tx_id,
            {
                "status": status,
                "gateway_status": gateway_status,
                "gateway_payload": gateway_payload,
                "paid_at": paid_at if paid_at is not None else None,
            },
        )

        if not tx:
            logger.warning(
                "Webhook received for unknown gateway_tx_id: %s", gateway_tx_id
            )
            return

        # Step 2: Only proceed with subscription activation on confirmed payment
        if status != "paid":
            return

        if tx.get("type") not in _SUBSCRIPTION_TYPES:
            return

        # Step 3a: Activate / extend user subscription if linked
        if tx.get("subscription_id"):
            try:
                billing_cycle = self._get_sub_billing_cycle(
                    tx["subscription_id"], is_group=False
                )
                if billing_cycle:
                    self.subscriptions_service.activate_and_extend_user_sub(
                        tx["subscription_id"], billing_cycle
                    )
                    logger.info(
                        "User subscription %s activated via gateway_tx_id %s",
                        tx["subscription_id"],
                        gateway_tx_id,
                    )
            except Exception as err:
                logger.error(
                    "Failed to extend user subscription %s: %s",
                    tx["subscription_id"],
                    str(err),
                )

        # Step 3b: Activate / extend group subscription if linked
        if tx.get("group_subscription_id"):
            try:
                billing_cycle = self._get_sub_billing_cycle(
                    tx["group_subscription_id"], is_group=True
                )
                if billing_cycle:
                    self.subscriptions_service.activate_and_extend_group_sub(
                        tx["group_subscription_id"], billing_cycle
                    )
                    logger.info(
                        "Group subscription %s activated via gateway_tx_id %s",
                        tx["group_subscription_id"],
                        gateway_tx_id,
                    )
            except Exception as err:
                logger.error(
                    "Failed to extend group subscription %s: %s",
                    tx["group_subscription_id"],
                    str(err),
                )

    def _get_sub_billing_cycle(self, id: str, is_group: bool) -> Optional[str]:
        """Reads billing_cycle from user_subscriptions or group_subscriptions by ID.
        Returns None if the row doesn't exist.
        """
        table = "group_subscriptions" if is_group else "user_subscriptions"
        try:
            data = maybe_single(
                self.sb.admin.from_(table).select("billing_cycle").eq("id", id)
            )
            return data.get("billing_cycle") if data else None
        except Exception as err:
            logger.error(
                "Error reading billing_cycle for %s %s: %s", table, id, str(err)
            )
            return None
