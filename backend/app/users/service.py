"""Users service — port of ``src/users/users.service.ts``."""
from typing import Optional

import bcrypt
from fastapi import HTTPException

from ..common.utils import iso_now
from ..db import maybe_single, supabase
from .schemas import (
    SetPinDto,
    UpdateSecurityDto,
    UpdateUserDto,
    UpsertBankAccountDto,
    VerifyPinDto,
)

BCRYPT_ROUNDS = 12


class UsersService:
    def __init__(self) -> None:
        self.sb = supabase

    def get_profile(self, user_id: str) -> dict:
        data = maybe_single(
            self.sb.admin.from_("users").select("*").eq("id", user_id)
        )
        if not data:
            raise HTTPException(404, f"User {user_id} not found")
        return data

    def ensure_profile(self, user_id: str, name: str, phone: Optional[str] = None) -> dict:
        """Upserts the profile row when a brand-new auth user signs up."""
        res = (
            self.sb.admin.from_("users")
            .upsert(
                {"id": user_id, "name": name, "phone": phone},
                on_conflict="id",
            )
            .execute()
        )
        return res.data[0] if res.data else None

    def update_profile(self, user_id: str, dto: UpdateUserDto) -> dict:
        payload = dto.model_dump(exclude_unset=True)
        res = (
            self.sb.admin.from_("users")
            .update(payload)
            .eq("id", user_id)
            .execute()
        )
        return res.data[0] if res.data else None

    def list_all(self) -> list:
        res = (
            self.sb.admin.from_("users")
            .select("id, name, phone, avatar_url, platform_role, created_at")
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []

    # ─────────────────────────────────────────────────
    # C2 — PIN SECURITY
    # ─────────────────────────────────────────────────
    def set_pin(self, user_id: str, dto: SetPinDto) -> dict:
        pin_hash = bcrypt.hashpw(
            dto.pin.encode(), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
        ).decode()
        self.sb.admin.from_("users").update({"pin_hash": pin_hash}).eq(
            "id", user_id
        ).execute()
        return {"success": True}

    def verify_pin(self, user_id: str, dto: VerifyPinDto) -> dict:
        data = maybe_single(
            self.sb.admin.from_("users").select("pin_hash").eq("id", user_id)
        )
        if data is None:
            raise HTTPException(404, f"User {user_id} not found")
        if not data.get("pin_hash"):
            return {"valid": False}
        valid = bcrypt.checkpw(dto.pin.encode(), data["pin_hash"].encode())
        return {"valid": valid}

    def get_security(self, user_id: str) -> dict:
        data = maybe_single(
            self.sb.admin.from_("users")
            .select("pin_hash, app_lock_enabled")
            .eq("id", user_id)
        )
        if data is None:
            raise HTTPException(404, f"User {user_id} not found")
        return {
            "has_pin": bool(data.get("pin_hash")),
            "app_lock_enabled": data.get("app_lock_enabled") or False,
        }

    def update_security(self, user_id: str, dto: UpdateSecurityDto) -> dict:
        self.sb.admin.from_("users").update(
            {"app_lock_enabled": dto.app_lock_enabled}
        ).eq("id", user_id).execute()
        return self.get_security(user_id)

    # ─────────────────────────────────────────────────
    # C3 — PAYOUT / BANK ACCOUNT
    # ─────────────────────────────────────────────────
    def get_bank_account(self, user_id: str) -> Optional[dict]:
        return maybe_single(
            self.sb.admin.from_("bank_accounts")
            .select("id, bank, account_number, holder_name, created_at, updated_at")
            .eq("user_id", user_id)
        )

    def upsert_bank_account(self, user_id: str, dto: UpsertBankAccountDto) -> dict:
        res = (
            self.sb.admin.from_("bank_accounts")
            .upsert(
                {
                    "user_id": user_id,
                    "bank": dto.bank,
                    "account_number": dto.account_number,
                    "holder_name": dto.holder_name,
                    "updated_at": iso_now(),
                },
                on_conflict="user_id",
            )
            .execute()
        )
        return res.data[0] if res.data else None

    def delete_bank_account(self, user_id: str) -> dict:
        self.sb.admin.from_("bank_accounts").delete().eq(
            "user_id", user_id
        ).execute()
        return {"success": True}
