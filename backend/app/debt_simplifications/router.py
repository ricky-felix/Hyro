"""Debt-simplifications router — port of ``src/debt-simplifications/debt-simplifications.controller.ts``.

Controller prefix: ``debts``

Route order: literal sub-routes (``/bill/:billId``) are registered BEFORE
param routes (``/:id/...``) to avoid shadowing.
"""
from fastapi import APIRouter, Depends

from ..common.types import AuthUser
from ..deps import current_user, get_auth
from .service import DebtSimplificationsService

router = APIRouter(
    prefix="/debts",
    tags=["debt-simplifications"],
    dependencies=[Depends(get_auth)],
)
service = DebtSimplificationsService()


@router.get("/bill/{bill_id}")
def list_for_bill(bill_id: str, user: AuthUser = Depends(current_user)):
    return service.list_for_bill(bill_id, user.id)


@router.post("/simplify/{bill_id}", status_code=201)
def simplify_bill(bill_id: str, user: AuthUser = Depends(current_user)):
    return service.simplify_bill(bill_id, user.id)


@router.patch("/{id}/settle")
def mark_settled(id: str, user: AuthUser = Depends(current_user)):
    return service.mark_settled(id, user.id)


@router.patch("/{id}/dismiss")
def dismiss(id: str, user: AuthUser = Depends(current_user)):
    return service.dismiss(id, user.id)
