"""RecurringBills service — port of ``src/recurring-bills/recurring-bills.service.ts``."""
import calendar
import json
import logging
from datetime import date, datetime, timedelta

from fastapi import HTTPException
from postgrest.exceptions import APIError

from ..bills.schemas import BillParticipantInput, CreateBillDto
from ..bills.service import BillsService
from ..common.types import RecurringFrequency
from ..common.utils import iso_now
from ..db import fetch_all, maybe_single, supabase
from .schemas import CreateRecurringBillDto, UpdateRecurringBillDto

logger = logging.getLogger(__name__)


def _to_date_string(d: date) -> str:
    """Mirror ``toISOString().split('T')[0]`` — returns 'YYYY-MM-DD'."""
    return d.isoformat()


def _advance_date(d: date, frequency: RecurringFrequency) -> date:
    """Port of the private ``advanceDate`` helper in the TS service.

    Mirrors JS ``Date.setDate/setMonth/setFullYear`` semantics:
    - weekly  → +7 days
    - monthly → +1 month (JS overflow behaviour: day rolls into next month)
    - yearly  → +1 year
    """
    if frequency == "weekly":
        return d + timedelta(days=7)

    if frequency == "monthly":
        # Mirror JS setMonth(getMonth()+1): overflow day rolls into next month
        month0 = (d.month - 1) + 1  # zero-based, add 1
        year = d.year + month0 // 12
        month = month0 % 12 + 1
        last_day = calendar.monthrange(year, month)[1]
        if d.day <= last_day:
            return date(year, month, d.day)
        # Day overflows: roll into the following month
        overflow = d.day - last_day
        return date(year, month, last_day) + timedelta(days=overflow)

    if frequency == "yearly":
        # +1 year; handle Feb-29 on non-leap years
        try:
            return d.replace(year=d.year + 1)
        except ValueError:
            # Feb 29 → Mar 1 in the next non-leap year (JS behaviour)
            return date(d.year + 1, 3, 1)

    raise ValueError(f"Unknown frequency: {frequency}")


def _parse_participants(raw) -> list:
    """JSONB field may arrive as a string or already as a list."""
    if isinstance(raw, str):
        return json.loads(raw)
    if raw is None:
        return []
    return list(raw)


class RecurringBillsService:
    def __init__(self) -> None:
        self.sb = supabase

    # ─────────────────────────────────────────────────────────────────
    # CRUD
    # ─────────────────────────────────────────────────────────────────

    def create(self, dto: CreateRecurringBillDto, user_id: str) -> dict:
        """Port of ``RecurringBillsService.create``."""
        try:
            res = (
                self.sb.admin.from_("recurring_bills")
                .insert(
                    {
                        "title": dto.title,
                        "description": dto.description,
                        "category": dto.category,
                        "total_amount": dto.total_amount,
                        "split_method": dto.split_method,
                        "frequency": dto.frequency,
                        "start_date": dto.start_date,
                        "end_date": dto.end_date,
                        "next_due_date": dto.next_due_date,
                        "is_active": dto.is_active if dto.is_active is not None else True,
                        "participants": json.dumps(
                            [p.model_dump() for p in dto.participants]
                        ),
                        "group_id": dto.group_id,
                        "paid_by": user_id,
                    }
                )
                .execute()
            )
        except APIError as e:
            raise HTTPException(400, str(e))
        return res.data[0]

    def find_one(self, id: str, user_id: str) -> dict:
        """Port of ``RecurringBillsService.findOne``."""
        row = maybe_single(
            self.sb.admin.from_("recurring_bills").select("*").eq("id", id)
        )
        if not row:
            raise HTTPException(404, f"RecurringBill {id} not found")
        if row["paid_by"] != user_id:
            raise HTTPException(403, "You do not have access to this recurring bill")
        return row

    def list_mine(self, user_id: str) -> list:
        """Port of ``RecurringBillsService.listMine``."""
        try:
            return fetch_all(
                self.sb.admin.from_("recurring_bills")
                .select("*")
                .eq("paid_by", user_id)
                .order("created_at", desc=True)
            )
        except APIError as e:
            raise HTTPException(400, str(e))

    def update(self, id: str, dto: UpdateRecurringBillDto, user_id: str) -> dict:
        """Port of ``RecurringBillsService.update``."""
        self.find_one(id, user_id)  # ownership check

        fields = dto.model_dump(exclude_unset=True)
        patch: dict = {}

        for key in (
            "title", "description", "category", "total_amount",
            "split_method", "frequency", "start_date", "end_date",
            "next_due_date", "is_active", "group_id",
        ):
            if key in fields:
                patch[key] = fields[key]

        if "participants" in fields and dto.participants is not None:
            patch["participants"] = json.dumps(
                [p.model_dump() for p in dto.participants]
            )

        patch["updated_at"] = iso_now()

        try:
            res = (
                self.sb.admin.from_("recurring_bills")
                .update(patch)
                .eq("id", id)
                .execute()
            )
        except APIError as e:
            raise HTTPException(400, str(e))
        return res.data[0]

    def delete(self, id: str, user_id: str) -> dict:
        """Port of ``RecurringBillsService.delete``."""
        self.find_one(id, user_id)  # ownership check
        try:
            self.sb.admin.from_("recurring_bills").delete().eq("id", id).execute()
        except APIError as e:
            raise HTTPException(400, str(e))
        return {"message": "RecurringBill deleted"}

    # ─────────────────────────────────────────────────────────────────
    # MATERIALIZE DUE BILLS  (called by scheduler)
    # ─────────────────────────────────────────────────────────────────

    def materialize_due(self, now: datetime) -> dict:
        """Port of ``RecurringBillsService.materializeDue``.

        Finds all active recurring bills whose ``next_due_date`` is on or
        before *now*, creates a real bill for each via
        ``BillsService.create_from_recurring``, then advances
        ``next_due_date`` by the configured frequency and deactivates
        records that have passed their ``end_date``.

        Returns ``{"created": <int>}`` — the count of bills materialised.
        """
        today_str = _to_date_string(now.date() if isinstance(now, datetime) else now)

        try:
            res = (
                self.sb.admin.from_("recurring_bills")
                .select("*")
                .eq("is_active", True)
                .lte("next_due_date", today_str)
                .execute()
            )
        except APIError as e:
            raise HTTPException(400, str(e))

        due_bills = res.data or []
        if not due_bills:
            return {"created": 0}

        bills_service = BillsService()
        created = 0

        for rb in due_bills:
            try:
                raw_participants = _parse_participants(rb.get("participants"))
                participants = [
                    BillParticipantInput(**p) if isinstance(p, dict) else p
                    for p in raw_participants
                ]

                create_dto = CreateBillDto(
                    title=rb["title"],
                    description=rb.get("description"),
                    category=rb.get("category"),
                    total_amount=rb["total_amount"],
                    split_method=rb["split_method"],
                    receipt_url=None,
                    group_id=rb.get("group_id"),
                    participants=participants,
                )

                bills_service.create_from_recurring(
                    create_dto,
                    rb["paid_by"],
                    rb["id"],
                )

                created += 1

                # Advance next_due_date
                current_due = date.fromisoformat(rb["next_due_date"])
                next_due = _advance_date(current_due, rb["frequency"])

                end_date_raw = rb.get("end_date")
                end_date = date.fromisoformat(end_date_raw) if end_date_raw else None
                is_still_active = (next_due <= end_date) if end_date else True

                self.sb.admin.from_("recurring_bills").update(
                    {
                        "next_due_date": _to_date_string(next_due),
                        "is_active": is_still_active,
                        "updated_at": iso_now(),
                    }
                ).eq("id", rb["id"]).execute()

            except Exception as exc:
                # Log per-bill failure and continue — one bad record must not
                # block materialisation of the rest (mirrors TS try/catch).
                logger.error(
                    "[RecurringBillsService] Failed to materialize bill %s: %s",
                    rb.get("id"),
                    exc,
                    exc_info=True,
                )

        return {"created": created}
