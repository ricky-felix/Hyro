"""Payment transactions controller — port of ``src/payment-transactions/payment-transactions.controller.ts``."""
from typing import Optional

from fastapi import APIRouter, Depends

from ..common.types import Gateway, TransactionStatus, TransactionType
from ..common.types import AuthUser
from ..deps import current_user, get_auth, require_roles
from .service import PaymentTransactionsService

router = APIRouter(
    prefix="/transactions",
    tags=["transactions"],
    dependencies=[Depends(get_auth)],
)
service = PaymentTransactionsService()


@router.get("/me")
def list_mine(user: AuthUser = Depends(current_user)):
    """Returns the authenticated user's own transaction history, newest first."""
    return service.list_mine(user.id)


@router.get(
    "",
    dependencies=[Depends(require_roles("super_admin"))],
)
def list_all(
    status: Optional[TransactionStatus] = None,
    gateway: Optional[Gateway] = None,
    type: Optional[TransactionType] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
):
    """Super-admin only: lists all transactions across all users.
    Supports optional query filters: status, gateway, type, limit, offset.
    """
    return service.list_all(
        status=status,
        gateway=gateway,
        type=type,
        limit=limit,
        offset=offset,
    )
