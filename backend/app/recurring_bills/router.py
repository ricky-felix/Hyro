"""Recurring-bills controller — port of ``src/recurring-bills/recurring-bills.controller.ts``."""
from datetime import datetime

from fastapi import APIRouter, Depends

from ..common.types import AuthUser
from ..deps import current_user, get_auth, require_roles
from .schemas import CreateRecurringBillDto, UpdateRecurringBillDto
from .service import RecurringBillsService

router = APIRouter(
    prefix="/recurring-bills",
    tags=["recurring-bills"],
    dependencies=[Depends(get_auth)],
)
service = RecurringBillsService()


# NOTE: literal route '/run-due' must be registered BEFORE the param route '/{id}'
# to prevent FastAPI from matching it as an id path parameter.

@router.post("/run-due", dependencies=[Depends(require_roles("super_admin"))])
def run_due():
    """Manual trigger for materialising due recurring bills.

    Super-admin only — intended for admin console or cron job HTTP trigger.
    """
    return service.materialize_due(datetime.utcnow())


@router.post("", status_code=201)
def create(dto: CreateRecurringBillDto, user: AuthUser = Depends(current_user)):
    return service.create(dto, user.id)


@router.get("")
def list_mine(user: AuthUser = Depends(current_user)):
    return service.list_mine(user.id)


@router.get("/{id}")
def find_one(id: str, user: AuthUser = Depends(current_user)):
    return service.find_one(id, user.id)


@router.patch("/{id}")
def update(id: str, dto: UpdateRecurringBillDto, user: AuthUser = Depends(current_user)):
    return service.update(id, dto, user.id)


@router.delete("/{id}")
def delete(id: str, user: AuthUser = Depends(current_user)):
    return service.delete(id, user.id)
