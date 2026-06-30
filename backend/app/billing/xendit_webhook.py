"""Xendit webhook controller — port of ``src/billing/xendit-webhook.controller.ts``.

Mounted WITHOUT the /api prefix in main.py.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from ..config import settings
from .service import BillingService

logger = logging.getLogger(__name__)

router = APIRouter()
service = BillingService()


def _map_xendit_status(xendit_status: str) -> Optional[str]:
    """Maps Xendit invoice status strings to internal TransactionStatus values."""
    mapping = {
        "paid": "paid",
        "settled": "paid",
        "expired": "expired",
        "failed": "failed",
        "pending": "pending",
    }
    return mapping.get(xendit_status.lower())


@router.post("/webhooks/xendit", status_code=200)
def handle_xendit(
    body: dict,
    x_callback_token: Optional[str] = Header(default=None, alias="x-callback-token"),
):
    """Handles Xendit invoice webhook callbacks.

    Supported events: invoice.paid, invoice.expired, invoice.failed

    Authentication: validates the x-callback-token header against
    the XENDIT_WEBHOOK_TOKEN environment variable.

    Always returns {"received": True} after signature validation.
    Downstream errors are logged but do not cause a non-2xx response to avoid
    infinite retries.
    """
    # ── Signature validation ──────────────────────────────────────────
    expected_token = settings.XENDIT_WEBHOOK_TOKEN
    if not expected_token or x_callback_token != expected_token:
        raise HTTPException(401, "Invalid Xendit webhook token")

    # ── Event parsing ─────────────────────────────────────────────────
    try:
        event = body.get("event", "")
        data = body.get("data", body)
        if not isinstance(data, dict):
            data = body

        # Handle top-level payload format (no event wrapper) as well as
        # the newer { event, data } format
        external_id = data.get("external_id") or body.get("external_id")
        raw_status = data.get("status") or body.get("status") or ""
        paid_at = data.get("paid_at") or body.get("paid_at")

        if not external_id:
            logger.warning("Xendit webhook missing external_id, skipping (event=%s)", event)
            return {"received": True}

        status = _map_xendit_status(raw_status)
        if not status:
            logger.warning(
                "Xendit webhook with unrecognised status '%s' for tx %s",
                raw_status,
                external_id,
            )
            return {"received": True}

        service.reconcile(
            {
                "gateway_tx_id": external_id,
                "status": status,
                "gateway_status": raw_status,
                "gateway_payload": body,
                "paid_at": paid_at if status == "paid" else None,
            }
        )
    except Exception as err:
        # Log but still return 200 — Xendit must not retry on application errors
        logger.error("Error processing Xendit webhook: %s", str(err))

    return {"received": True}
