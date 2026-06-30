"""Users controller — port of ``src/users/users.controller.ts``."""
from fastapi import APIRouter, Depends

from ..common.types import AuthUser
from ..deps import current_user, get_auth, require_roles
from .schemas import (
    SetPinDto,
    UpdateSecurityDto,
    UpdateUserDto,
    UpsertBankAccountDto,
    VerifyPinDto,
)
from .service import UsersService

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(get_auth)])
service = UsersService()


@router.get("/me")
def get_profile(user: AuthUser = Depends(current_user)):
    return service.get_profile(user.id)


@router.patch("/me")
def update_profile(dto: UpdateUserDto, user: AuthUser = Depends(current_user)):
    return service.update_profile(user.id, dto)


# Super-admin only: full user list for the platform-wide dashboard
@router.get("", dependencies=[Depends(require_roles("super_admin"))])
def list_all():
    return service.list_all()


# ── C2 — PIN SECURITY ────────────────────────────────────────────
@router.patch("/me/pin")
def set_pin(dto: SetPinDto, user: AuthUser = Depends(current_user)):
    return service.set_pin(user.id, dto)


@router.post("/me/pin/verify", status_code=201)
def verify_pin(dto: VerifyPinDto, user: AuthUser = Depends(current_user)):
    return service.verify_pin(user.id, dto)


@router.get("/me/security")
def get_security(user: AuthUser = Depends(current_user)):
    return service.get_security(user.id)


@router.patch("/me/security")
def update_security(dto: UpdateSecurityDto, user: AuthUser = Depends(current_user)):
    return service.update_security(user.id, dto)


# ── C3 — PAYOUT / BANK ACCOUNT ───────────────────────────────────
@router.get("/me/bank-account")
def get_bank_account(user: AuthUser = Depends(current_user)):
    return service.get_bank_account(user.id)


@router.put("/me/bank-account")
def upsert_bank_account(
    dto: UpsertBankAccountDto, user: AuthUser = Depends(current_user)
):
    return service.upsert_bank_account(user.id, dto)


@router.delete("/me/bank-account")
def delete_bank_account(user: AuthUser = Depends(current_user)):
    return service.delete_bank_account(user.id)
