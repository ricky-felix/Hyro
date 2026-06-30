"""Midtrans webhook controller — port of ``src/billing/midtrans-webhook.controller.ts``.

Mounted WITHOUT the /api prefix in main.py.
"""
import hashlib
import logging

from fastapi import APIRouter, HTTPException

from ..config import settings
from .service import BillingService

logger = logging.getLogger(__name__)

router = APIRouter()
service = BillingService()


def _map_midtrans_status(tx_status: str) -> str:
    """Maps Midtrans transaction_status values to internal TransactionStatus values.

    Midtrans status reference:
      settlement / capture → paid  (card payments use 'capture')
      pending              → pending
      expire               → expired
      deny / cancel / failure → failed
    """
    mapping = {
        "settlement": "paid",
        "capture": "paid",
        "expire": "expired",
        "deny": "failed",
        "cancel": "failed",
        "failure": "failed",
    }
    return mapping.get(tx_status.lower(), "pending")


@router.post("/webhooks/midtrans", status_code=200)
def handle_midtrans(body: dict):
    """Handles Midtrans payment notification webhooks.

    Authentication: validates the signature_key field in the payload.
    Midtrans signature: SHA-512(order_id + status_code + gross_amount + ServerKey)

    Always returns {"received": True} after signature validation.
    Downstream errors are logged but do not cause a non-2xx response.
    """
    # ── Signature validation ──────────────────────────────────────────
    server_key = settings.MIDTRANS_SERVER_KEY or ""
    order_id = body.get("order_id", "")
    status_code = body.get("status_code", "")
    gross_amount = body.get("gross_amount", "")
    received_signature = body.get("signature_key", "")

    expected_signature = hashlib.sha512(
        f"{order_id}{status_code}{gross_amount}{server_key}".encode()
    ).hexdigest()

    if expected_signature != received_signature:
        raise HTTPException(401, "Invalid Midtrans signature")

    # ── Event processing ──────────────────────────────────────────────
    try:
        tx_status = body.get("transaction_status", "")
        settlement_time = body.get("settlement_time")
        status = _map_midtrans_status(tx_status)

        if not order_id:
            logger.warning("Midtrans webhook missing order_id, skipping")
            return {"received": True}

        service.reconcile(
            {
                "gateway_tx_id": order_id,
                "status": status,
                "gateway_status": tx_status,
                "gateway_payload": body,
                "paid_at": settlement_time if status == "paid" else None,
            }
        )
    except Exception as err:
        # Log but return 200 — Midtrans retries on non-2xx responses
        logger.error("Error processing Midtrans webhook: %s", str(err))

    return {"received": True}
