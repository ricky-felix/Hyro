"""Bill-participants service — port of ``src/bill-participants/bill-participants.service.ts``."""
from fastapi import HTTPException

from ..bills.strategies import get_strategy
from ..db import maybe_single, supabase
from .schemas import AddParticipantDto


class BillParticipantsService:
    def __init__(self) -> None:
        self.sb = supabase

    # ── ADD ──────────────────────────────────────────────────────────
    def add_participant(self, bill_id: str, dto: AddParticipantDto, user_id: str) -> list:
        bill = self._require_bill_as_payer(bill_id, user_id)

        # Check not already a participant
        existing = maybe_single(
            self.sb.admin.from_("bill_participants")
            .select("id")
            .eq("bill_id", bill_id)
            .eq("user_id", dto.user_id)
        )
        if existing:
            raise HTTPException(
                400,
                f"User {dto.user_id} is already a participant of bill {bill_id}",
            )

        try:
            self.sb.admin.from_("bill_participants").insert(
                {
                    "bill_id": bill_id,
                    "user_id": dto.user_id,
                    "shares": dto.shares if dto.shares is not None else 1,
                    "percentage": dto.percentage,
                }
            ).execute()
        except Exception as e:
            raise HTTPException(400, str(e))

        self._recompute_splits(
            bill_id, bill["total_amount"], bill["split_method"], bill["paid_by"]
        )

        return self._list_for_bill(bill_id)

    # ── REMOVE ───────────────────────────────────────────────────────
    def remove_participant(
        self, bill_id: str, participant_user_id: str, user_id: str
    ) -> list:
        bill = self._require_bill_as_payer(bill_id, user_id)

        if participant_user_id == bill["paid_by"]:
            raise HTTPException(400, "Cannot remove the bill payer from participants")

        try:
            self.sb.admin.from_("bill_participants").delete().eq(
                "bill_id", bill_id
            ).eq("user_id", participant_user_id).execute()
        except Exception as e:
            raise HTTPException(400, str(e))

        self._recompute_splits(
            bill_id, bill["total_amount"], bill["split_method"], bill["paid_by"]
        )

        return self._list_for_bill(bill_id)

    # ── Private helpers ───────────────────────────────────────────────
    def _require_bill_as_payer(self, bill_id: str, user_id: str) -> dict:
        bill = maybe_single(
            self.sb.admin.from_("bills")
            .select("id, paid_by, total_amount, split_method")
            .eq("id", bill_id)
        )
        if not bill:
            raise HTTPException(404, f"Bill {bill_id} not found")
        if bill["paid_by"] != user_id:
            raise HTTPException(403, "Only the bill payer can modify participants")
        return bill

    def _list_for_bill(self, bill_id: str) -> list:
        try:
            res = (
                self.sb.admin.from_("bill_participants")
                .select("*")
                .eq("bill_id", bill_id)
                .execute()
            )
        except Exception as e:
            raise HTTPException(400, str(e))
        return res.data or []

    def _recompute_splits(
        self, bill_id: str, total_amount: int, split_method: str, payer_id: str
    ) -> None:
        res = (
            self.sb.admin.from_("bill_participants")
            .select("id, user_id, shares, percentage")
            .eq("bill_id", bill_id)
            .execute()
        )
        participants = res.data or []
        if not participants:
            return

        # Delete existing splits
        self.sb.admin.from_("bill_splits").delete().eq("bill_id", bill_id).execute()

        inputs = [
            {
                "user_id": p["user_id"],
                "shares": p["shares"],
                "percentage": p.get("percentage"),
            }
            for p in participants
        ]

        strategy = get_strategy(split_method)
        results = strategy(total_amount, inputs, payer_id)

        participant_id_map = {p["user_id"]: p["id"] for p in participants}

        split_rows = [
            {
                "bill_id": bill_id,
                "participant_id": participant_id_map.get(r["user_id"], ""),
                "user_id": r["user_id"],
                "amount_owed": r["amount_owed"],
                "is_payer": r["is_payer"],
            }
            for r in results
        ]

        try:
            self.sb.admin.from_("bill_splits").insert(split_rows).execute()
        except Exception as e:
            raise HTTPException(400, str(e))
