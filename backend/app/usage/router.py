"""Usage controller — port of ``src/usage/usage.controller.ts``."""
from fastapi import APIRouter, Depends

from ..common.types import AuthUser
from ..deps import current_user, get_auth
from .service import UsageService

router = APIRouter(
    prefix="/usage",
    tags=["usage"],
    dependencies=[Depends(get_auth)],
)
service = UsageService()


@router.get("/me")
def get_current(user: AuthUser = Depends(current_user)):
    """Returns the current month's usage row for the authenticated user.
    Creates a zero row if one doesn't exist yet.
    """
    return service.get_current(user.id)


@router.post("/me/groups/increment", status_code=201)
def increment_groups(user: AuthUser = Depends(current_user)):
    """Increments the groups_created counter for the authenticated user.

    NOTE: In normal application flow this counter is incremented server-side
    by GroupsService after a successful group insert — not by the client.
    This endpoint exists for internal testing and administrative corrections.
    """
    service.increment_groups(user.id)
    return {"message": "groups_created incremented"}


@router.post("/me/bills/increment", status_code=201)
def increment_bills(user: AuthUser = Depends(current_user)):
    """Increments the bills_created counter for the authenticated user.

    NOTE: Same as above — BillsService should call UsageService.increment_bills
    directly after inserting a bill row, not via this HTTP endpoint.
    This endpoint is for testing and manual corrections only.
    """
    service.increment_bills(user.id)
    return {"message": "bills_created incremented"}
