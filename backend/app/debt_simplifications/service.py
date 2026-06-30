"""Debt-simplifications service — port of ``src/debt-simplifications/debt-simplifications.service.ts``."""
from typing import List

from fastapi import HTTPException

from ..common.utils import iso_now
from ..db import maybe_single, supabase


class DebtSimplificationsService:
    def __init__(self) -> None:
        self.sb = supabase

    # ── SIMPLIFY BILL ────────────────────────────────────────────────
    def simplify_bill(self, bill_id: str, user_id: str) -> list:
        """
        Runs the greedy min-cash-flow algorithm over a bill's splits,
        deletes prior pending simplifications, and inserts the new edges.

        Algorithm:
          1. Build a net-balance map: positive = owed money (creditor),
             negative = owes money (debtor).
             Payer: net = total_amount - payer_share (owed back by everyone).
             Non-payer: net = -(amount_owed).
          2. Repeatedly find max creditor and max debtor, emit a transfer of
             min(|credit|, |debt|), reduce both balances, until all are zero.
        """
        self._require_bill_access(bill_id, user_id)

        try:
            splits_res = (
                self.sb.admin.from_("bill_splits")
                .select("user_id, amount_owed, is_payer")
                .eq("bill_id", bill_id)
                .execute()
            )
        except Exception as e:
            raise HTTPException(400, str(e))

        splits = splits_res.data or []
        if not splits:
            raise HTTPException(400, "No splits found for this bill")

        total: int = sum(s["amount_owed"] for s in splits)

        balance: dict = {}
        for split in splits:
            if split["is_payer"]:
                balance[split["user_id"]] = total - split["amount_owed"]
            else:
                balance[split["user_id"]] = -(split["amount_owed"])

        edges = self._min_cash_flow(balance)

        # Delete prior pending debt_simplifications for this bill
        self.sb.admin.from_("debt_simplifications").delete().eq(
            "bill_id", bill_id
        ).eq("status", "pending").execute()

        if not edges:
            return []

        rows = [
            {
                "bill_id": bill_id,
                "from_user_id": e["from_user_id"],
                "to_user_id": e["to_user_id"],
                "amount": e["amount"],
                "status": "pending",
                "chain": e["chain"],
            }
            for e in edges
        ]

        try:
            res = (
                self.sb.admin.from_("debt_simplifications").insert(rows).execute()
            )
        except Exception as e:
            raise HTTPException(400, str(e))

        return res.data or []

    # ── LIST FOR BILL ────────────────────────────────────────────────
    def list_for_bill(self, bill_id: str, user_id: str) -> list:
        self._require_bill_access(bill_id, user_id)

        try:
            res = (
                self.sb.admin.from_("debt_simplifications")
                .select("*")
                .eq("bill_id", bill_id)
                .order("created_at", desc=True)
                .execute()
            )
        except Exception as e:
            raise HTTPException(400, str(e))

        return res.data or []

    # ── MARK SETTLED ─────────────────────────────────────────────────
    def mark_settled(self, id: str, user_id: str) -> dict:
        debt = self._require_debt(id)

        if debt["from_user_id"] != user_id and debt["to_user_id"] != user_id:
            raise HTTPException(
                403, "Only the from or to user can mark this debt as settled"
            )

        if debt["status"] == "settled":
            raise HTTPException(400, "Debt is already settled")

        try:
            res = (
                self.sb.admin.from_("debt_simplifications")
                .update({"status": "settled", "settled_at": iso_now()})
                .eq("id", id)
                .execute()
            )
        except Exception as e:
            raise HTTPException(400, str(e))

        return res.data[0]

    # ── DISMISS ──────────────────────────────────────────────────────
    def dismiss(self, id: str, user_id: str) -> dict:
        debt = self._require_debt(id)

        if debt["from_user_id"] != user_id and debt["to_user_id"] != user_id:
            raise HTTPException(
                403, "Only the from or to user can dismiss this debt"
            )

        if debt["status"] != "pending":
            raise HTTPException(
                400, f"Cannot dismiss a debt with status '{debt['status']}'"
            )

        try:
            res = (
                self.sb.admin.from_("debt_simplifications")
                .update({"status": "dismissed"})
                .eq("id", id)
                .execute()
            )
        except Exception as e:
            raise HTTPException(400, str(e))

        return res.data[0]

    # ── Private: greedy min-cash-flow ────────────────────────────────
    def _min_cash_flow(self, balance: dict) -> List[dict]:
        """
        Greedy algorithm: at each step, find the person with the most credit (+)
        and most debt (-). Transfer min(credit, debt). Minimises the number of
        transactions.
        """
        edges: List[dict] = []
        bal = dict(balance)

        is_zero = lambda v: abs(v) < 1

        max_iterations = len(bal) * len(bal)  # safety cap
        iterations = 0

        while iterations < max_iterations:
            iterations += 1

            max_credit = 0.0
            max_debt = 0.0
            creditor = ""
            debtor = ""

            for uid, b in bal.items():
                if is_zero(b):
                    continue
                if b > max_credit:
                    max_credit = b
                    creditor = uid
                if b < max_debt:
                    max_debt = b
                    debtor = uid

            if not creditor or not debtor:
                break  # all settled

            transfer = min(max_credit, abs(max_debt))
            if transfer < 1:
                break

            amount = round(transfer)
            edges.append(
                {
                    "from_user_id": debtor,
                    "to_user_id": creditor,
                    "amount": amount,
                    "chain": [
                        f"{debtor} owes {creditor} Rp {amount:,}".replace(",", ".")
                    ],
                }
            )

            bal[creditor] = max_credit - transfer
            bal[debtor] = max_debt + transfer

        return edges

    # ── Private helpers ───────────────────────────────────────────────
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
            raise HTTPException(403, "You are not a participant of this bill")

    def _require_debt(self, id: str) -> dict:
        data = maybe_single(
            self.sb.admin.from_("debt_simplifications").select("*").eq("id", id)
        )
        if not data:
            raise HTTPException(404, f"DebtSimplification {id} not found")
        return data
