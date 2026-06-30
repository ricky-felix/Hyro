"""Bill-comments router — port of ``src/bill-comments/bill-comments.controller.ts``.

Controller has ``@Controller()`` with no prefix. Routes span two path groups:
  GET  /bills/:billId/comments
  POST /comments
  PATCH /comments/:id
  DELETE /comments/:id

A single router with prefix="" is used; full paths are declared per route.
"""
from fastapi import APIRouter, Depends

from ..common.types import AuthUser
from ..deps import current_user, get_auth
from .schemas import CreateCommentDto, UpdateCommentDto
from .service import BillCommentsService

router = APIRouter(
    prefix="",
    tags=["bill-comments"],
    dependencies=[Depends(get_auth)],
)
service = BillCommentsService()


@router.get("/bills/{bill_id}/comments")
def list_for_bill(bill_id: str, user: AuthUser = Depends(current_user)):
    return service.list_for_bill(bill_id, user.id)


@router.post("/comments", status_code=201)
def create(dto: CreateCommentDto, user: AuthUser = Depends(current_user)):
    return service.create(dto, user.id)


@router.patch("/comments/{id}")
def update(
    id: str,
    dto: UpdateCommentDto,
    user: AuthUser = Depends(current_user),
):
    return service.update(id, dto, user.id)


@router.delete("/comments/{id}")
def soft_delete(id: str, user: AuthUser = Depends(current_user)):
    return service.soft_delete(id, user.id)
