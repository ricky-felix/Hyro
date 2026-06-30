"""Contacts controller — port of ``src/contacts/contacts.controller.ts``."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from ..common.types import AuthUser
from ..deps import current_user, get_auth
from .schemas import CreateContactDto, TouchContactDto, UpdateContactDto
from .service import ContactsService

router = APIRouter(
    prefix="/contacts", tags=["contacts"], dependencies=[Depends(get_auth)]
)
service = ContactsService()

VALID_SORTS = {"recent", "frequent", "name"}


@router.get("")
def list_contacts(
    user: AuthUser = Depends(current_user),
    sort: Optional[str] = Query(default=None),
    limit: Optional[str] = Query(default=None),
):
    """Lists the authenticated user's contacts.

    Query params:
      sort  — 'recent' | 'frequent' | 'name'  (default: 'recent')
      limit — positive integer                  (default: 50)
    """
    resolved_sort = sort if sort in VALID_SORTS else "recent"

    resolved_limit = 50
    if limit is not None:
        try:
            resolved_limit = int(limit)
        except ValueError:
            raise HTTPException(400, "limit must be a positive integer")
        if resolved_limit < 1:
            raise HTTPException(400, "limit must be a positive integer")

    return service.list_mine(user.id, sort=resolved_sort, limit=resolved_limit)


# Literal route declared BEFORE /{id} so FastAPI does not treat "recents" as an id
@router.get("/recents")
def recents(user: AuthUser = Depends(current_user)):
    """Returns the 10 most recently used contacts."""
    return service.recents(user.id)


@router.post("", status_code=201)
def create(dto: CreateContactDto, user: AuthUser = Depends(current_user)):
    """Creates a new contact. Upserts on (owner_id, phone) — safe to retry."""
    return service.create(dto, user.id)


# Literal route declared BEFORE /{id}
@router.post("/touch", status_code=201)
def touch(dto: TouchContactDto, user: AuthUser = Depends(current_user)):
    """Manually bumps use_count and refreshes last_used_at for a contact.
    Body: { phone? } | { contact_id? }  (one required)
    """
    identifier = dto.phone or dto.contact_id
    if not identifier:
        raise HTTPException(
            400, "Provide either phone or contact_id in the request body"
        )
    service.touch(user.id, identifier)
    return {"success": True}


@router.patch("/{id}")
def update(
    id: str, dto: UpdateContactDto, user: AuthUser = Depends(current_user)
):
    """Updates a contact owned by the authenticated user."""
    return service.update(id, dto, user.id)


@router.delete("/{id}", status_code=204)
def remove(id: str, user: AuthUser = Depends(current_user)):
    """Deletes a contact owned by the authenticated user."""
    from fastapi import Response

    service.delete(id, user.id)
    return Response(status_code=204)
