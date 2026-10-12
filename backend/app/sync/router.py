"""Sync controller — GET /sync/pull?since=<server_time from last pull>.

Single aggregator endpoint for the offline-first client: one call instead of
five separate list requests, scoped to the groups the authenticated user
belongs to.
"""
from typing import Optional

from fastapi import APIRouter, Depends

from ..common.types import AuthUser
from ..deps import current_user, get_auth
from .service import SyncService

router = APIRouter(prefix="/sync", tags=["sync"], dependencies=[Depends(get_auth)])
service = SyncService()


@router.get("/pull")
def pull(since: Optional[str] = None, user: AuthUser = Depends(current_user)):
    return service.pull(user.id, since)
