"""Payments controller — port of ``src/payments/payments.controller.ts``."""
from fastapi import APIRouter, Depends

from ..common.types import AuthUser
from ..deps import current_user, get_auth
from .schemas import CreatePaymentDto, RejectPaymentDto
from .service import PaymentsService

router = APIRouter(
    prefix="/payments",
    tags=["payments"],
    dependencies=[Depends(get_auth)],
)
service = PaymentsService()


# Literal sub-routes registered BEFORE param routes
@router.get("/me")
def find_mine(user: AuthUser = Depends(current_user)):
    return service.find_mine(user.id)


@router.get("/group/{group_id}")
def find_for_group(group_id: str):
    return service.find_for_group(group_id)


@router.get("/round/{round_id}")
def find_for_round(round_id: str):
    return service.find_for_round(round_id)


@router.post("", status_code=201)
def create(dto: CreatePaymentDto, user: AuthUser = Depends(current_user)):
    return service.create(dto, user.id)


@router.patch("/{id}/confirm")
def confirm(id: str, user: AuthUser = Depends(current_user)):
    return service.confirm(id, user.id)


@router.patch("/{id}/reject")
def reject(
    id: str,
    dto: RejectPaymentDto,
    user: AuthUser = Depends(current_user),
):
    return service.reject(id, dto, user.id)
