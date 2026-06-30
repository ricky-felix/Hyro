"""Storage controller — port of ``src/storage/storage.controller.ts``."""
from fastapi import APIRouter, Depends

from ..common.types import AuthUser
from ..deps import current_user, get_auth
from .schemas import CreateReadUrlDto, CreateUploadUrlDto, DeleteObjectDto
from .service import StorageService

router = APIRouter(
    prefix="/storage", tags=["storage"], dependencies=[Depends(get_auth)]
)
service = StorageService()


@router.post("/upload-url", status_code=201)
def create_upload_url(
    dto: CreateUploadUrlDto, user: AuthUser = Depends(current_user)
):
    """Issues a signed upload URL so the frontend can upload directly to Supabase
    Storage without proxying the file through the backend.

    Response: { bucket, path, signed_url, token }
    """
    return service.create_upload_url(dto, user.id)


@router.post("/read-url", status_code=201)
def create_read_url(
    dto: CreateReadUrlDto, user: AuthUser = Depends(current_user)
):
    """Issues a signed read URL for a private storage object.

    Ownership: the path must belong to the requesting user
    (``path.startsWith(userId + '/')``). super_admin can read any path.

    Response: { signed_url, expires_at }
    """
    is_super_admin = user.platform_role == "super_admin"
    return service.create_read_url(dto, user.id, is_super_admin)


@router.delete("/object")
def delete_object(
    dto: DeleteObjectDto, user: AuthUser = Depends(current_user)
):
    """Deletes a storage object. Body: { bucket, path }.

    Ownership: the path must belong to the requesting user.
    super_admin can delete any path.
    """
    from fastapi import Response

    is_super_admin = user.platform_role == "super_admin"
    service.delete(dto.bucket, dto.path, user.id, is_super_admin)
    return Response(status_code=204)
