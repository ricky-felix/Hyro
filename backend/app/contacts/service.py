"""Contacts service — port of ``src/contacts/contacts.service.ts``."""
import re
from typing import Literal, Optional

from fastapi import HTTPException

from ..common.utils import iso_now
from ..db import maybe_single, supabase
from .schemas import CreateContactDto, UpdateContactDto

ContactSortOption = Literal["recent", "frequent", "name"]

_UUID_V4_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


class ContactsService:
    def __init__(self) -> None:
        self.sb = supabase

    def list_mine(
        self,
        user_id: str,
        sort: ContactSortOption = "recent",
        limit: int = 50,
    ) -> list:
        """Returns the authenticated user's contacts with flexible sort options.

        - 'recent'   -> last_used_at DESC NULLS LAST  (default)
        - 'frequent' -> use_count DESC
        - 'name'     -> name ASC (alphabetical)
        """
        query = (
            self.sb.admin.from_("user_contacts")
            .select("*")
            .eq("owner_id", user_id)
            .limit(limit)
        )

        if sort == "frequent":
            query = query.order("use_count", desc=True)
        elif sort == "name":
            query = query.order("name", desc=False)
        else:
            # 'recent': NULLS LAST — contacts never used appear at the bottom
            query = query.order("last_used_at", desc=True, nulls_first=False)

        res = query.execute()
        return res.data or []

    def recents(self, user_id: str, limit: int = 10) -> list:
        """Returns the N most recently used contacts for the given user."""
        return self.list_mine(user_id, sort="recent", limit=limit)

    def create(self, dto: CreateContactDto, user_id: str) -> dict:
        """Creates a new contact for the authenticated user.

        Business rules:
        - At least one of ``phone`` or ``contact_id`` must be provided.
        - If ``phone`` is supplied and matches an existing platform user,
          ``contact_id`` is auto-resolved.
        - Upserts on (owner_id, phone) so retrying the same request is idempotent.
        """
        if not dto.phone and not dto.contact_id:
            raise HTTPException(
                400, "At least one of phone or contact_id must be provided"
            )

        resolved_contact_id = dto.contact_id or None

        # Auto-resolve contact_id from phone when not supplied
        if dto.phone and not resolved_contact_id:
            matched = maybe_single(
                self.sb.admin.from_("users")
                .select("id")
                .eq("phone", dto.phone)
            )
            if matched:
                resolved_contact_id = matched["id"]

        payload: dict = {
            "owner_id": user_id,
            "name": dto.name,
            "contact_id": resolved_contact_id,
        }
        if dto.phone:
            payload["phone"] = dto.phone

        if dto.phone:
            res = (
                self.sb.admin.from_("user_contacts")
                .upsert(payload, on_conflict="owner_id,phone", ignore_duplicates=False)
                .execute()
            )
        else:
            res = (
                self.sb.admin.from_("user_contacts")
                .insert(payload)
                .execute()
            )

        return res.data[0]

    def update(self, id: str, dto: UpdateContactDto, user_id: str) -> dict:
        """Updates a contact that belongs to the authenticated user."""
        self._assert_ownership(id, user_id)

        res = (
            self.sb.admin.from_("user_contacts")
            .update(dto.model_dump(exclude_unset=True))
            .eq("id", id)
            .execute()
        )
        return res.data[0]

    def delete(self, id: str, user_id: str) -> None:
        """Deletes a contact that belongs to the authenticated user."""
        self._assert_ownership(id, user_id)

        self.sb.admin.from_("user_contacts").delete().eq("id", id).execute()

    def touch(self, user_id: str, phone_or_contact_user_id: str) -> None:
        """Bumps use_count by 1 and refreshes last_used_at for the contact.

        ``phone_or_contact_user_id`` may be a phone string or a platform user
        UUID — detection is via UUID v4 regex, mirroring the TS implementation.
        Idempotent: a missing contact row is a no-op.
        """
        if not phone_or_contact_user_id:
            raise HTTPException(
                400, "phone or contact_id must be provided for touch"
            )

        query = (
            self.sb.admin.from_("user_contacts")
            .select("id, use_count")
            .eq("owner_id", user_id)
        )

        if _UUID_V4_RE.match(phone_or_contact_user_id):
            query = query.eq("contact_id", phone_or_contact_user_id)
        else:
            query = query.eq("phone", phone_or_contact_user_id)

        contact = maybe_single(query)

        # No matching contact — idempotent no-op
        if not contact:
            return

        self.sb.admin.from_("user_contacts").update(
            {
                "use_count": (contact.get("use_count") or 0) + 1,
                "last_used_at": iso_now(),
            }
        ).eq("id", contact["id"]).execute()

    # ── Private helpers ──────────────────────────────────────────────────────

    def _assert_ownership(self, id: str, user_id: str) -> dict:
        """Fetches the contact row and verifies ownership.
        Raises 404 when not found, 403 when owned by another user.
        """
        contact = maybe_single(
            self.sb.admin.from_("user_contacts")
            .select("id, owner_id")
            .eq("id", id)
        )

        if not contact:
            raise HTTPException(404, f"Contact {id} not found")

        if contact["owner_id"] != user_id:
            raise HTTPException(403, "You do not own this contact")

        return contact
