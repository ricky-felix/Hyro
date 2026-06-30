"""Invite-links controller — port of ``src/invite-links/invite-links.controller.ts``."""
from fastapi import APIRouter, Depends

from ..common.types import AuthUser
from ..deps import current_user, get_auth
from .schemas import CreateInviteDto
from .service import InviteLinksService

router = APIRouter(
    prefix="/invites",
    tags=["invite-links"],
    dependencies=[Depends(get_auth)],
)
service = InviteLinksService()


@router.post("", status_code=201)
def create(dto: CreateInviteDto, user: AuthUser = Depends(current_user)):
    return service.create(dto, user.id)


# Literal sub-routes registered BEFORE param routes
@router.get("/group/{group_id}")
def list_for_group(group_id: str, user: AuthUser = Depends(current_user)):
    return service.list_for_group(group_id, user.id)


@router.post("/redeem/{token}", status_code=201)
def redeem(token: str, user: AuthUser = Depends(current_user)):
    return service.redeem(token, user.id)


@router.patch("/{id}/revoke")
def revoke(id: str, user: AuthUser = Depends(current_user)):
    return service.revoke(id, user.id)
