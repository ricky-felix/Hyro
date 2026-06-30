"""Notifications controller — port of ``src/notifications/notifications.controller.ts``."""
from fastapi import APIRouter, Depends

from ..common.types import AuthUser
from ..deps import current_user, get_auth
from .service import NotificationsService

router = APIRouter(
    prefix="/notifications",
    tags=["notifications"],
    dependencies=[Depends(get_auth)],
)
service = NotificationsService()


# Register literal route /unread-count BEFORE param route /:id/read
@router.get("/unread-count")
def unread_count(user: AuthUser = Depends(current_user)):
    return service.unread_count(user.id)


@router.get("")
def list_mine(user: AuthUser = Depends(current_user)):
    return service.list_mine(user.id)


@router.post("/read-all")
def mark_all_read(user: AuthUser = Depends(current_user)):
    return service.mark_all_read(user.id)


@router.post("/{id}/read")
def mark_read(id: str, user: AuthUser = Depends(current_user)):
    return service.mark_read(id, user.id)
