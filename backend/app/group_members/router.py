"""Group-members controller — port of ``src/group-members/group-members.controller.ts``."""
from fastapi import APIRouter, Depends

from ..common.types import AuthUser
from ..deps import current_user, get_auth
from .schemas import AddMemberDto, AssignGiliranDto
from .service import GroupMembersService

# Controller prefix: groups/:groupId/members → /groups/{group_id}/members
router = APIRouter(
    prefix="/groups/{group_id}/members",
    tags=["group-members"],
    dependencies=[Depends(get_auth)],
)
service = GroupMembersService()


@router.get("")
def list_members(group_id: str):
    return service.list_for_group(group_id)


# Literal sub-routes must be registered BEFORE param routes
@router.post("/assign-giliran", status_code=201)
def assign_giliran(
    group_id: str,
    dto: AssignGiliranDto,
    user: AuthUser = Depends(current_user),
):
    return service.assign_giliran_order(group_id, dto, user.id)


@router.post("/random-shuffle", status_code=201)
def random_shuffle(group_id: str, user: AuthUser = Depends(current_user)):
    return service.random_shuffle(group_id, user.id)


@router.post("", status_code=201)
def add_member(
    group_id: str,
    dto: AddMemberDto,
    user: AuthUser = Depends(current_user),
):
    return service.add_member(group_id, dto, user.id)


@router.delete("/{user_id}")
def remove_member(
    group_id: str,
    user_id: str,
    user: AuthUser = Depends(current_user),
):
    return service.remove_member(group_id, user_id, user.id)
