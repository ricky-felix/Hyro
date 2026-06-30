"""Bills controller — port of ``src/bills/bills.controller.ts``."""
from fastapi import APIRouter, Depends

from ..common.types import AuthUser
from ..deps import current_user, get_auth, require_plan
from .schemas import CreateBillDto, UpdateBillDto
from .service import BillsService

router = APIRouter(prefix="/bills", tags=["bills"], dependencies=[Depends(get_auth)])
service = BillsService()


@router.post("", status_code=201, dependencies=[Depends(require_plan("bills"))])
def create(dto: CreateBillDto, user: AuthUser = Depends(current_user)):
    return service.create(dto, user.id)


@router.get("")
def list_mine(user: AuthUser = Depends(current_user)):
    return service.list_mine(user.id)


@router.get("/{id}")
def find_one(id: str, user: AuthUser = Depends(current_user)):
    return service.find_one(id, user.id)


@router.patch("/{id}")
def update(id: str, dto: UpdateBillDto, user: AuthUser = Depends(current_user)):
    return service.update(id, dto, user.id)


@router.delete("/{id}")
def delete(id: str, user: AuthUser = Depends(current_user)):
    return service.delete(id, user.id)


@router.patch("/{id}/settle")
def mark_settled(id: str, user: AuthUser = Depends(current_user)):
    return service.mark_settled(id, user.id)
