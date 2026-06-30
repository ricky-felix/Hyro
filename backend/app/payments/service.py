"""Payments service — port of ``src/payments/payments.service.ts``."""
from fastapi import HTTPException

from ..common.utils import iso_now
from ..db import maybe_single, supabase
from ..notifications.service import NotificationsService
from .schemas import CreatePaymentDto, RejectPaymentDto


class PaymentsService:
    def __init__(self) -> None:
        self.sb = supabase
        self.notifications = NotificationsService()

    def find_for_round(self, round_id: str) -> list:
        res = (
            self.sb.admin.from_("payments")
            .select("*")
            .eq("round_id", round_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []

    def find_for_group(self, group_id: str) -> list:
        res = (
            self.sb.admin.from_("payments")
            .select("*")
            .eq("group_id", group_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []

    def find_mine(self, user_id: str) -> list:
        res = (
            self.sb.admin.from_("payments")
            .select("*, groups(name), rounds(round_number, scheduled_date)")
            .eq("payer_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []

    def create(self, dto: CreatePaymentDto, user_id: str) -> dict:
        # Resolve group_id from the round
        round_ = maybe_single(
            self.sb.admin.from_("rounds")
            .select("id, group_id")
            .eq("id", dto.round_id)
        )
        if not round_:
            raise HTTPException(404, f"Round {dto.round_id} not found")

        try:
            res = (
                self.sb.admin.from_("payments")
                .insert(
                    {
                        "group_id": round_["group_id"],
                        "round_id": dto.round_id,
                        "payer_id": user_id,
                        "amount": dto.amount,
                        "status": "pending",
                        "proof_url": dto.proof_url,
                        "notes": dto.notes,
                        "paid_at": iso_now(),
                    }
                )
                .execute()
            )
        except Exception as e:
            if "23505" in str(e):
                raise HTTPException(
                    400, "You have already submitted a payment for this round"
                )
            raise

        return res.data[0]

    def confirm(self, id: str, requester_id: str) -> dict:
        payment = self._find_payment_or_throw(id)
        self._assert_group_admin(payment["group_id"], requester_id)

        if payment["status"] != "pending":
            raise HTTPException(
                400,
                f"Payment cannot be confirmed — current status is '{payment['status']}'",
            )

        res = (
            self.sb.admin.from_("payments")
            .update({"status": "confirmed", "confirmed_at": iso_now()})
            .eq("id", id)
            .execute()
        )
        data = res.data[0]

        # Notify the payer
        self.notifications.create_many(
            [
                {
                    "user_id": payment["payer_id"],
                    "type": "payment_confirmed",
                    "title": "Pembayaran Dikonfirmasi",
                    "body": f"Pembayaran sebesar Rp {payment['amount']:,} telah dikonfirmasi.".replace(",", "."),
                    "metadata": {
                        "payment_id": id,
                        "group_id": payment["group_id"],
                        "round_id": payment["round_id"],
                    },
                }
            ]
        )

        return data

    def reject(self, id: str, dto: RejectPaymentDto, requester_id: str) -> dict:
        payment = self._find_payment_or_throw(id)
        self._assert_group_admin(payment["group_id"], requester_id)

        if payment["status"] != "pending":
            raise HTTPException(
                400,
                f"Payment cannot be rejected — current status is '{payment['status']}'",
            )

        res = (
            self.sb.admin.from_("payments")
            .update(
                {
                    "status": "rejected",
                    "rejection_reason": dto.rejection_reason,
                }
            )
            .eq("id", id)
            .execute()
        )
        data = res.data[0]

        # Notify the payer
        self.notifications.create_many(
            [
                {
                    "user_id": payment["payer_id"],
                    "type": "payment_rejected",
                    "title": "Pembayaran Ditolak",
                    "body": f"Pembayaran Anda ditolak: {dto.rejection_reason}",
                    "metadata": {
                        "payment_id": id,
                        "group_id": payment["group_id"],
                        "round_id": payment["round_id"],
                    },
                }
            ]
        )

        return data

    def _find_payment_or_throw(self, id: str) -> dict:
        data = maybe_single(
            self.sb.admin.from_("payments").select("*").eq("id", id)
        )
        if not data:
            raise HTTPException(404, f"Payment {id} not found")
        return data

    def _assert_group_admin(self, group_id: str, user_id: str) -> None:
        """Asserts the requester is admin_id OR has group_role='admin'."""
        group = maybe_single(
            self.sb.admin.from_("groups").select("admin_id").eq("id", group_id)
        )
        if not group:
            raise HTTPException(404, f"Group {group_id} not found")
        if group.get("admin_id") == user_id:
            return

        membership = maybe_single(
            self.sb.admin.from_("group_members")
            .select("group_role")
            .eq("group_id", group_id)
            .eq("user_id", user_id)
        )
        if not membership or membership.get("group_role") != "admin":
            raise HTTPException(403, "You are not an admin of this group")
