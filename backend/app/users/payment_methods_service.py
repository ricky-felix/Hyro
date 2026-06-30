"""Payment-methods service — port of ``src/users/payment-methods.service.ts``.

Manages the v1 JSONB ``payment_methods`` array on the users row. No funds are
held or routed — this is a directory only.
"""
import logging
import uuid
from typing import List

from fastapi import HTTPException

from ..common.utils import iso_now
from ..db import supabase
from .schemas import CreatePaymentMethodDto, UpdatePaymentMethodDto

logger = logging.getLogger("payment_methods")


def _generate_method_id() -> str:
    return f"pm_{uuid.uuid4()}"


def _is_legacy_v0(methods: list) -> bool:
    """v0 legacy = array of strings; v1 = array of objects."""
    return len(methods) > 0 and isinstance(methods[0], str)


def _mask_for_peer(method: dict) -> dict:
    """Mask account_number/phone to last-4 for co-members; drop updated_at."""
    rest = {k: v for k, v in method.items() if k != "updated_at"}
    acct = method.get("account_number")
    phone = method.get("phone")
    rest["account_number"] = f"••••{acct[-4:]}" if acct else None
    rest["phone"] = f"••••{phone[-4:]}" if phone else None
    return rest


class PaymentMethodsService:
    def __init__(self) -> None:
        self.sb = supabase

    # ── Private helpers ──────────────────────────────────────────
    def _fetch_raw_methods(self, user_id: str) -> list:
        res = (
            self.sb.admin.from_("users")
            .select("payment_methods")
            .eq("id", user_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(404, f"User {user_id} not found")
        return res.data[0].get("payment_methods") or []

    def _persist_methods(self, user_id: str, methods: List[dict]) -> None:
        self.sb.admin.from_("users").update(
            {"payment_methods": methods}
        ).eq("id", user_id).execute()

    def _parse_v1_methods(self, raw: list) -> List[dict]:
        if len(raw) == 0:
            return []
        if _is_legacy_v0(raw):
            logger.warning(
                "[PaymentMethodsService] v0 legacy format detected (string[]). "
                "Returning empty v1 array. Frontend should show migration banner."
            )
            return []
        return raw

    def _assert_co_member(self, requester_user_id: str, target_user_id: str) -> None:
        requester = (
            self.sb.admin.from_("users")
            .select("platform_role")
            .eq("id", requester_user_id)
            .execute()
        )
        if requester.data and requester.data[0].get("platform_role") == "super_admin":
            return

        shared = (
            self.sb.admin.from_("group_members")
            .select("group_id")
            .eq("user_id", requester_user_id)
            .execute()
        )
        if not shared.data:
            raise HTTPException(
                403,
                "You must be a group co-member to view this user's payment methods",
            )

        requester_group_ids = [r["group_id"] for r in shared.data]
        target = (
            self.sb.admin.from_("group_members")
            .select("group_id")
            .eq("user_id", target_user_id)
            .in_("group_id", requester_group_ids)
            .execute()
        )
        if not target.data:
            raise HTTPException(
                403,
                "You must be a group co-member to view this user's payment methods",
            )

    # ── Public API ───────────────────────────────────────────────
    def list_own(self, user_id: str) -> dict:
        raw = self._fetch_raw_methods(user_id)
        return {"data": self._parse_v1_methods(raw)}

    def list_for_peer(self, target_user_id: str, requester_user_id: str) -> dict:
        target_user = (
            self.sb.admin.from_("users")
            .select("id")
            .eq("id", target_user_id)
            .execute()
        )
        if not target_user.data:
            raise HTTPException(404, f"User {target_user_id} not found")

        if requester_user_id == target_user_id:
            return self.list_own(target_user_id)

        self._assert_co_member(requester_user_id, target_user_id)

        raw = self._fetch_raw_methods(target_user_id)
        methods = self._parse_v1_methods(raw)
        return {"data": [_mask_for_peer(m) for m in methods]}

    def create(self, user_id: str, dto: CreatePaymentMethodDto) -> dict:
        raw = self._fetch_raw_methods(user_id)
        methods = self._parse_v1_methods(raw)

        timestamp = iso_now()
        new_method = {
            "id": _generate_method_id(),
            "type": dto.type,
            "label": dto.label.strip(),
            "account_number": dto.account_number.strip() if dto.account_number else None,
            "holder_name": dto.holder_name.strip() if dto.holder_name else None,
            "phone": dto.phone.strip() if dto.phone else None,
            "qris_image_path": dto.qris_image_path,
            "is_primary": dto.is_primary or False,
            "created_at": timestamp,
            "updated_at": timestamp,
        }

        if new_method["is_primary"]:
            methods = [{**m, "is_primary": False} for m in methods]

        methods.append(new_method)
        self._persist_methods(user_id, methods)
        return new_method

    def update(self, user_id: str, method_id: str, dto: UpdatePaymentMethodDto) -> dict:
        raw = self._fetch_raw_methods(user_id)
        methods = self._parse_v1_methods(raw)

        idx = next((i for i, m in enumerate(methods) if m["id"] == method_id), -1)
        if idx == -1:
            raise HTTPException(
                404, f"Payment method {method_id} not found for user {user_id}"
            )

        if dto.is_primary is True:
            methods = [{**m, "is_primary": False} for m in methods]

        updated = dict(methods[idx])
        fields = dto.model_dump(exclude_unset=True)
        if "label" in fields:
            updated["label"] = dto.label.strip()
        if "account_number" in fields:
            updated["account_number"] = (
                dto.account_number.strip() if dto.account_number else None
            )
        if "holder_name" in fields:
            updated["holder_name"] = dto.holder_name.strip() if dto.holder_name else None
        if "phone" in fields:
            updated["phone"] = dto.phone.strip() if dto.phone else None
        if "qris_image_path" in fields:
            updated["qris_image_path"] = dto.qris_image_path
        if "is_primary" in fields:
            updated["is_primary"] = dto.is_primary
        updated["updated_at"] = iso_now()

        methods[idx] = updated
        self._persist_methods(user_id, methods)
        return updated

    def delete(self, user_id: str, method_id: str) -> None:
        raw = self._fetch_raw_methods(user_id)
        methods = self._parse_v1_methods(raw)

        idx = next((i for i, m in enumerate(methods) if m["id"] == method_id), -1)
        if idx == -1:
            raise HTTPException(
                404, f"Payment method {method_id} not found for user {user_id}"
            )

        was_primary = methods[idx]["is_primary"]
        remaining = [m for m in methods if m["id"] != method_id]

        if was_primary and remaining:
            oldest = min(remaining, key=lambda m: m["created_at"])
            promote_idx = next(i for i, m in enumerate(remaining) if m["id"] == oldest["id"])
            remaining[promote_idx] = {
                **remaining[promote_idx],
                "is_primary": True,
                "updated_at": iso_now(),
            }

        self._persist_methods(user_id, remaining)
