"""Bill-settlements service — port of ``src/bill-settlements/bill-settlements.service.ts``."""
from fastapi import HTTPException

from ..common.utils import iso_now
from ..db import maybe_single, supabase
from ..notifications.service import NotificationsService
from .schemas import CreateSettlementDto, RejectSettlementDto


class BillSettlementsService:
    def __init__(self) -> None:
        self.sb = supabase
        self.notifications = NotificationsService()

    # ── CREATE ───────────────────────────────────────────────────────
    def create(self, dto: CreateSettlementDto, user_id: str) -> dict:
        # Validate caller is a participant of the bill
        participant_row = maybe_single(
            self.sb.admin.from_("bill_participants")
            .select("id")
            .eq("bill_id", dto.bill_id)
            .eq("user_id", user_id)
        )
        if not participant_row:
            raise HTTPException(403, "You are not a participant of this bill")

        # Validate bill exists and receiver is the payer
        bill = maybe_single(
            self.sb.admin.from_("bills")
            .select("id, paid_by, title, status")
            .eq("id", dto.bill_id)
        )
        if not bill:
            raise HTTPException(404, f"Bill {dto.bill_id} not found")

        if bill["status"] == "settled":
            raise HTTPException(400, "Bill is already fully settled")

        if bill["paid_by"] != dto.receiver_id:
            raise HTTPException(400, "receiver_id must be the bill payer")

        if user_id == dto.receiver_id:
            raise HTTPException(400, "Payer cannot settle a debt to themselves")

        try:
            res = (
                self.sb.admin.from_("bill_settlements")
                .insert(
                    {
                        "bill_id": dto.bill_id,
                        "payer_id": user_id,
                        "receiver_id": dto.receiver_id,
                        "amount": dto.amount,
                        "proof_url": dto.proof_url,
                        "notes": dto.notes,
                        "status": "pending",
                    }
                )
                .execute()
            )
        except Exception as e:
            raise HTTPException(400, str(e))

        return res.data[0]

    # ── CONFIRM ──────────────────────────────────────────────────────
    def confirm(self, id: str, user_id: str) -> dict:
        settlement = self._require_settlement(id)

        if settlement["receiver_id"] != user_id:
            raise HTTPException(403, "Only the settlement receiver can confirm it")

        if settlement["status"] != "pending":
            raise HTTPException(400, f"Settlement is already {settlement['status']}")

        now = iso_now()
        try:
            res = (
                self.sb.admin.from_("bill_settlements")
                .update({"status": "confirmed", "confirmed_at": now, "settled_at": now})
                .eq("id", id)
                .execute()
            )
        except Exception as e:
            raise HTTPException(400, str(e))

        updated = res.data[0]

        # Auto-settle bill if all non-payer participants are confirmed
        self._check_and_auto_settle(settlement["bill_id"], user_id)

        # Notify the payer
        self.notifications.create(
            {
                "user_id": settlement["payer_id"],
                "type": "settlement_confirmed",
                "title": "Pembayaran dikonfirmasi",
                "body": (
                    f"Pembayaranmu sebesar Rp "
                    f"{int(settlement['amount']):,} telah dikonfirmasi".replace(",", ".")
                ),
                "metadata": {
                    "settlement_id": id,
                    "bill_id": settlement["bill_id"],
                },
            }
        )

        return updated

    # ── REJECT ───────────────────────────────────────────────────────
    def reject(self, id: str, dto: RejectSettlementDto, user_id: str) -> dict:
        settlement = self._require_settlement(id)

        if settlement["receiver_id"] != user_id:
            raise HTTPException(403, "Only the settlement receiver can reject it")

        if settlement["status"] != "pending":
            raise HTTPException(400, f"Settlement is already {settlement['status']}")

        updated_notes = f"REJECTED: {dto.reason}"

        try:
            res = (
                self.sb.admin.from_("bill_settlements")
                .update({"status": "rejected", "notes": updated_notes})
                .eq("id", id)
                .execute()
            )
        except Exception as e:
            raise HTTPException(400, str(e))

        updated = res.data[0]

        # Notify the payer
        self.notifications.create(
            {
                "user_id": settlement["payer_id"],
                "type": "settlement_rejected",
                "title": "Pembayaran ditolak",
                "body": f"Pembayaranmu ditolak: {dto.reason}",
                "metadata": {
                    "settlement_id": id,
                    "bill_id": settlement["bill_id"],
                },
            }
        )

        return updated

    # ── LIST FOR BILL ────────────────────────────────────────────────
    def list_for_bill(self, bill_id: str, user_id: str) -> list:
        self._require_bill_access(bill_id, user_id)

        try:
            res = (
                self.sb.admin.from_("bill_settlements")
                .select("*")
                .eq("bill_id", bill_id)
                .order("created_at", desc=True)
                .execute()
            )
        except Exception as e:
            raise HTTPException(400, str(e))

        return res.data or []

    # ── LIST MINE ────────────────────────────────────────────────────
    def list_mine(self, user_id: str) -> list:
        try:
            res = (
                self.sb.admin.from_("bill_settlements")
                .select("*")
                .or_(f"payer_id.eq.{user_id},receiver_id.eq.{user_id}")
                .order("created_at", desc=True)
                .execute()
            )
        except Exception as e:
            raise HTTPException(400, str(e))

        return res.data or []

    # ── Private helpers ───────────────────────────────────────────────
    def _require_settlement(self, id: str) -> dict:
        data = maybe_single(
            self.sb.admin.from_("bill_settlements").select("*").eq("id", id)
        )
        if not data:
            raise HTTPException(404, f"Settlement {id} not found")
        return data

    def _require_bill_access(self, bill_id: str, user_id: str) -> None:
        bill = maybe_single(
            self.sb.admin.from_("bills").select("paid_by").eq("id", bill_id)
        )
        if not bill:
            raise HTTPException(404, f"Bill {bill_id} not found")

        if bill["paid_by"] == user_id:
            return

        participant = maybe_single(
            self.sb.admin.from_("bill_participants")
            .select("id")
            .eq("bill_id", bill_id)
            .eq("user_id", user_id)
        )
        if not participant:
            raise HTTPException(403, "You do not have access to this bill")

    def _check_and_auto_settle(self, bill_id: str, _confirmer_id: str) -> None:
        bill = maybe_single(
            self.sb.admin.from_("bills")
            .select("id, paid_by, status, title")
            .eq("id", bill_id)
        )
        if not bill or bill["status"] == "settled":
            return

        participants_res = (
            self.sb.admin.from_("bill_participants")
            .select("user_id")
            .eq("bill_id", bill_id)
            .neq("user_id", bill["paid_by"])
            .execute()
        )
        participants = participants_res.data or []
        if not participants:
            return

        non_payer_ids = [p["user_id"] for p in participants]

        confirmed_res = (
            self.sb.admin.from_("bill_settlements")
            .select("payer_id")
            .eq("bill_id", bill_id)
            .eq("status", "confirmed")
            .execute()
        )
        confirmed_payer_ids = {
            s["payer_id"] for s in (confirmed_res.data or [])
        }

        all_settled = all(uid in confirmed_payer_ids for uid in non_payer_ids)
        if all_settled:
            self.sb.admin.from_("bills").update(
                {"status": "settled", "settled_at": iso_now()}
            ).eq("id", bill_id).execute()
