"""Bill-participants router — port of ``src/bill-participants/bill-participants.controller.ts``.

Controller prefix: ``bills/:billId/participants``
"""
from fastapi import APIRouter, Depends

from ..common.types import AuthUser
from ..deps import current_user, get_auth
from .schemas import AddParticipantDto
from .service import BillParticipantsService

router = APIRouter(
    prefix="/bills/{bill_id}/participants",
    tags=["bill-participants"],
    dependencies=[Depends(get_auth)],
)
service = BillParticipantsService()


@router.post("", status_code=201)
def add_participant(
    bill_id: str,
    dto: AddParticipantDto,
    user: AuthUser = Depends(current_user),
):
    return service.add_participant(bill_id, dto, user.id)


@router.delete("/{user_id}")
def remove_participant(
    bill_id: str,
    user_id: str,
    user: AuthUser = Depends(current_user),
):
    return service.remove_participant(bill_id, user_id, user.id)
