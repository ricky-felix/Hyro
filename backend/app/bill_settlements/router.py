"""Bill-settlements router — port of ``src/bill-settlements/bill-settlements.controller.ts``.

Controller prefix: ``settlements``

Route order: literal sub-routes (``/me``, ``/bill/:billId``) are registered
BEFORE the param route (``/:id/...``) to avoid shadowing.
"""
from fastapi import APIRouter, Depends

from ..common.types import AuthUser
from ..deps import current_user, get_auth
from .schemas import CreateSettlementDto, RejectSettlementDto
from .service import BillSettlementsService

router = APIRouter(
    prefix="/settlements",
    tags=["bill-settlements"],
    dependencies=[Depends(get_auth)],
)
service = BillSettlementsService()


@router.get("/me")
def list_mine(user: AuthUser = Depends(current_user)):
    return service.list_mine(user.id)


@router.get("/bill/{bill_id}")
def list_for_bill(bill_id: str, user: AuthUser = Depends(current_user)):
    return service.list_for_bill(bill_id, user.id)


@router.post("", status_code=201)
def create(dto: CreateSettlementDto, user: AuthUser = Depends(current_user)):
    return service.create(dto, user.id)


@router.patch("/{id}/confirm")
def confirm(id: str, user: AuthUser = Depends(current_user)):
    return service.confirm(id, user.id)


@router.patch("/{id}/reject")
def reject(
    id: str,
    dto: RejectSettlementDto,
    user: AuthUser = Depends(current_user),
):
    return service.reject(id, dto, user.id)
