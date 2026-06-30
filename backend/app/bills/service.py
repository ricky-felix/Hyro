"""Bills service — port of ``src/bills/bills.service.ts``."""
from typing import List

from fastapi import HTTPException

from ..common.utils import iso_now
from ..db import supabase
from ..notifications.service import NotificationsService
from .schemas import CreateBillDto, UpdateBillDto
from .strategies import get_strategy


def _to_dicts(participants) -> List[dict]:
    out = []
    for p in participants:
        out.append(p.model_dump() if hasattr(p, "model_dump") else dict(p))
    return out


class BillsService:
    def __init__(self) -> None:
        self.sb = supabase
        self.notifications = NotificationsService()

    # ── CREATE ───────────────────────────────────────────────────
    def create(self, dto: CreateBillDto, user_id: str) -> dict:
        res = (
            self.sb.admin.from_("bills")
            .insert(
                {
                    "title": dto.title,
                    "description": dto.description,
                    "category": dto.category,
                    "total_amount": dto.total_amount,
                    "split_method": dto.split_method,
                    "receipt_url": dto.receipt_url,
                    "group_id": dto.group_id,
                    "paid_by": user_id,
                }
            )
            .execute()
        )
        bill = res.data[0]

        participants = self._ensure_payer(_to_dicts(dto.participants), user_id)

        participant_rows = [
            {
                "bill_id": bill["id"],
                "user_id": p["user_id"],
                "shares": p.get("shares") or 1,
                "percentage": p.get("percentage"),
            }
            for p in participants
        ]
        inserted = (
            self.sb.admin.from_("bill_participants")
            .insert(participant_rows)
            .execute()
        )

        self._compute_and_insert_splits(
            bill["id"],
            bill["total_amount"],
            bill["split_method"],
            participants,
            user_id,
            inserted.data,
        )

        non_payers = [p for p in participants if p["user_id"] != user_id]
        self.notifications.create_many(
            [
                {
                    "user_id": p["user_id"],
                    "type": "bill_created",
                    "title": "Tagihan baru",
                    "body": f'Kamu ditambahkan ke tagihan "{bill["title"]}"',
                    "metadata": {"bill_id": bill["id"]},
                }
                for p in non_payers
            ]
        )

        return self.find_one(bill["id"], user_id)

    # ── READ ─────────────────────────────────────────────────────
    def find_one(self, bill_id: str, user_id: str) -> dict:
        res = (
            self.sb.admin.from_("bills")
            .select("*, bill_participants(*), bill_splits(*)")
            .eq("id", bill_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(404, f"Bill {bill_id} not found")
        bill = res.data[0]

        is_visible = bill["paid_by"] == user_id or any(
            p["user_id"] == user_id for p in bill.get("bill_participants", [])
        )
        if not is_visible:
            raise HTTPException(403, "You do not have access to this bill")

        return bill

    def list_mine(self, user_id: str) -> list:
        as_payer = (
            self.sb.admin.from_("bills")
            .select("*, bill_participants(*), bill_splits(*)")
            .eq("paid_by", user_id)
            .execute()
        ).data or []

        as_participant = (
            self.sb.admin.from_("bill_participants")
            .select("bill_id")
            .eq("user_id", user_id)
            .execute()
        ).data or []

        payer_ids = {b["id"] for b in as_payer}
        participant_bill_ids = [
            row["bill_id"] for row in as_participant if row["bill_id"] not in payer_ids
        ]

        as_participant_bills = []
        if participant_bill_ids:
            as_participant_bills = (
                self.sb.admin.from_("bills")
                .select("*, bill_participants(*), bill_splits(*)")
                .in_("id", participant_bill_ids)
                .execute()
            ).data or []

        return [*as_payer, *as_participant_bills]

    # ── UPDATE ───────────────────────────────────────────────────
    def update(self, bill_id: str, dto: UpdateBillDto, user_id: str) -> dict:
        bill = self.find_one(bill_id, user_id)
        if bill["paid_by"] != user_id:
            raise HTTPException(403, "Only the bill payer can update it")

        fields = dto.model_dump(exclude_unset=True)
        needs_recompute = (
            "total_amount" in fields
            or "split_method" in fields
            or "participants" in fields
        )

        patch = {}
        for key in ("title", "description", "category", "receipt_url", "total_amount", "split_method"):
            if key in fields:
                patch[key] = fields[key]

        if patch:
            self.sb.admin.from_("bills").update(patch).eq("id", bill_id).execute()

        if needs_recompute:
            effective_total = fields.get("total_amount", bill["total_amount"])
            effective_method = fields.get("split_method", bill["split_method"])

            if "participants" in fields:
                effective_participants = self._ensure_payer(
                    _to_dicts(dto.participants), user_id
                )
                self.sb.admin.from_("bill_participants").delete().eq(
                    "bill_id", bill_id
                ).execute()

                rows = [
                    {
                        "bill_id": bill_id,
                        "user_id": p["user_id"],
                        "shares": p.get("shares") or 1,
                        "percentage": p.get("percentage"),
                    }
                    for p in effective_participants
                ]
                inserted = (
                    self.sb.admin.from_("bill_participants").insert(rows).execute()
                )

                self.sb.admin.from_("bill_splits").delete().eq(
                    "bill_id", bill_id
                ).execute()

                self._compute_and_insert_splits(
                    bill_id,
                    effective_total,
                    effective_method,
                    effective_participants,
                    user_id,
                    inserted.data,
                )
            else:
                existing = (
                    self.sb.admin.from_("bill_participants")
                    .select("id, user_id, shares, percentage")
                    .eq("bill_id", bill_id)
                    .execute()
                ).data or []

                self.sb.admin.from_("bill_splits").delete().eq(
                    "bill_id", bill_id
                ).execute()

                mapped = [
                    {
                        "user_id": ep["user_id"],
                        "shares": ep["shares"],
                        "percentage": ep.get("percentage"),
                    }
                    for ep in existing
                ]

                self._compute_and_insert_splits(
                    bill_id,
                    effective_total,
                    effective_method,
                    mapped,
                    user_id,
                    existing,
                )

        return self.find_one(bill_id, user_id)

    # ── DELETE ───────────────────────────────────────────────────
    def delete(self, bill_id: str, user_id: str) -> dict:
        bill = self.find_one(bill_id, user_id)
        if bill["paid_by"] != user_id:
            raise HTTPException(403, "Only the bill payer can delete it")

        count_res = (
            self.sb.admin.from_("bill_settlements")
            .select("id", count="exact")
            .eq("bill_id", bill_id)
            .execute()
        )
        if (count_res.count or 0) > 0:
            raise HTTPException(
                400, "Cannot delete a bill that already has settlement records"
            )

        self.sb.admin.from_("bills").delete().eq("id", bill_id).execute()
        return {"message": "Bill deleted"}

    # ── MARK SETTLED ─────────────────────────────────────────────
    def mark_settled(self, bill_id: str, user_id: str) -> dict:
        bill = self.find_one(bill_id, user_id)
        if bill["paid_by"] != user_id:
            raise HTTPException(403, "Only the bill payer can mark it as settled")
        if bill["status"] == "settled":
            raise HTTPException(400, "Bill is already settled")

        res = (
            self.sb.admin.from_("bills")
            .update({"status": "settled", "settled_at": iso_now()})
            .eq("id", bill_id)
            .execute()
        )
        return res.data[0]

    # ── Internal: recurring materialization ──────────────────────
    def create_from_recurring(
        self, dto: CreateBillDto, user_id: str, recurring_bill_id: str
    ) -> dict:
        participants = self._ensure_payer(_to_dicts(dto.participants), user_id)

        res = (
            self.sb.admin.from_("bills")
            .insert(
                {
                    "title": dto.title,
                    "description": dto.description,
                    "category": dto.category,
                    "total_amount": dto.total_amount,
                    "split_method": dto.split_method,
                    "receipt_url": dto.receipt_url,
                    "group_id": dto.group_id,
                    "paid_by": user_id,
                    "recurring_bill_id": recurring_bill_id,
                }
            )
            .execute()
        )
        bill = res.data[0]

        participant_rows = [
            {
                "bill_id": bill["id"],
                "user_id": p["user_id"],
                "shares": p.get("shares") or 1,
                "percentage": p.get("percentage"),
            }
            for p in participants
        ]
        inserted = (
            self.sb.admin.from_("bill_participants").insert(participant_rows).execute()
        )

        self._compute_and_insert_splits(
            bill["id"],
            bill["total_amount"],
            bill["split_method"],
            participants,
            user_id,
            inserted.data,
        )

        return bill

    # ── Private helpers ──────────────────────────────────────────
    def _ensure_payer(self, participants: List[dict], payer_id: str) -> List[dict]:
        if not any(p["user_id"] == payer_id for p in participants):
            return [{"user_id": payer_id, "shares": 1}, *participants]
        return participants

    def _compute_and_insert_splits(
        self,
        bill_id: str,
        total_amount: int,
        split_method: str,
        participants: List[dict],
        payer_id: str,
        inserted_participants: List[dict],
    ) -> None:
        strategy = get_strategy(split_method)
        results = strategy(total_amount, participants, payer_id)

        participant_id_map = {p["user_id"]: p["id"] for p in inserted_participants}

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

        self.sb.admin.from_("bill_splits").insert(split_rows).execute()
