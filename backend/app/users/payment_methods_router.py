"""Payment-methods controller — port of ``src/users/payment-methods.controller.ts``.

Mounted under ``/users`` (same prefix as UsersController). The literal ``me/*``
routes are declared BEFORE the ``{userId}`` peer route so "me" is never parsed
as a userId.
"""
from fastapi import APIRouter, Depends, Response

from ..common.types import AuthUser
from ..deps import current_user, get_auth
from .payment_methods_service import PaymentMethodsService
from .schemas import CreatePaymentMethodDto, UpdatePaymentMethodDto

router = APIRouter(prefix="/users", tags=["payment-methods"], dependencies=[Depends(get_auth)])
service = PaymentMethodsService()


# ── Owner routes — /users/me/payment-methods ─────────────────────
@router.get("/me/payment-methods")
def list_own(user: AuthUser = Depends(current_user)):
    return service.list_own(user.id)


@router.post("/me/payment-methods", status_code=201)
def create(dto: CreatePaymentMethodDto, user: AuthUser = Depends(current_user)):
    return service.create(user.id, dto)


@router.put("/me/payment-methods/{id}")
def update(id: str, dto: UpdatePaymentMethodDto, user: AuthUser = Depends(current_user)):
    return service.update(user.id, id, dto)


@router.delete("/me/payment-methods/{id}", status_code=204)
def delete(id: str, user: AuthUser = Depends(current_user)):
    service.delete(user.id, id)
    return Response(status_code=204)


# ── Peer route — /users/:userId/payment-methods ──────────────────
@router.get("/{userId}/payment-methods")
def list_for_peer(userId: str, user: AuthUser = Depends(current_user)):
    return service.list_for_peer(userId, user.id)
