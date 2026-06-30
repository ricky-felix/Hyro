"""Groups controller — port of ``src/groups/groups.controller.ts``."""
from fastapi import APIRouter, Depends

from ..common.types import AuthUser
from ..deps import current_user, get_auth, require_plan
from .schemas import CreateGroupDto, UpdateGroupDto
from .service import GroupsService

router = APIRouter(prefix="/groups", tags=["groups"], dependencies=[Depends(get_auth)])
service = GroupsService()


@router.get("")
def find_all(user: AuthUser = Depends(current_user)):
    return service.find_all_for_user(user.id)


@router.get("/{id}")
def find_one(id: str):
    return service.find_one(id)


@router.post("", status_code=201, dependencies=[Depends(require_plan("groups"))])
def create(dto: CreateGroupDto, user: AuthUser = Depends(current_user)):
    return service.create(dto, user.id)


@router.patch("/{id}")
def update(id: str, dto: UpdateGroupDto, user: AuthUser = Depends(current_user)):
    return service.update(id, dto, user.id)


@router.delete("/{id}")
def remove(id: str, user: AuthUser = Depends(current_user)):
    return service.remove(id, user.id)
