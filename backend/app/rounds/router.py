"""Rounds controller — port of ``src/rounds/rounds.controller.ts``.

The NestJS controller uses @Controller() (no prefix) and declares full paths on
each handler. We mirror that here with an empty-prefix APIRouter and full paths
in every decorator.
"""
from fastapi import APIRouter, Depends

from ..common.types import AuthUser
from ..deps import current_user, get_auth
from .schemas import SetRecipientDto
from .service import RoundsService

router = APIRouter(tags=["rounds"], dependencies=[Depends(get_auth)])
service = RoundsService()


# GET /groups/:groupId/rounds
@router.get("/groups/{group_id}/rounds")
def list_for_group(group_id: str):
    return service.list_for_group(group_id)


# GET /rounds/:id
@router.get("/rounds/{id}")
def find_one(id: str):
    return service.find_one(id)


# PATCH /rounds/:id/recipient
@router.patch("/rounds/{id}/recipient")
def set_recipient(
    id: str,
    dto: SetRecipientDto,
    user: AuthUser = Depends(current_user),
):
    return service.set_recipient(id, dto.recipient_id, user.id)


# POST /rounds/:id/activate
@router.post("/rounds/{id}/activate", status_code=201)
def activate(id: str, user: AuthUser = Depends(current_user)):
    return service.activate(id, user.id)


# POST /rounds/:id/complete
@router.post("/rounds/{id}/complete", status_code=201)
def complete(id: str, user: AuthUser = Depends(current_user)):
    return service.complete(id, user.id)
