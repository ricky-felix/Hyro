"""Invite-links service — port of ``src/invite-links/invite-links.service.ts``."""
from datetime import datetime, timezone

from fastapi import HTTPException

from ..db import maybe_single, supabase


class InviteLinksService:
    def __init__(self) -> None:
        self.sb = supabase

    def create(self, dto, user_id: str) -> dict:
        self.assert_group_admin(dto.group_id, user_id)

        res = (
            self.sb.admin.from_("invite_links")
            .insert(
                {
                    "group_id": dto.group_id,
                    "created_by": user_id,
                    "max_uses": dto.max_uses,
                    "expires_at": dto.expires_at,
                    "is_active": True,
                }
            )
            .execute()
        )
        return res.data[0]

    def list_for_group(self, group_id: str, user_id: str) -> list:
        self.assert_group_admin(group_id, user_id)

        res = (
            self.sb.admin.from_("invite_links")
            .select("*")
            .eq("group_id", group_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []

    def revoke(self, id: str, user_id: str) -> dict:
        invite = maybe_single(
            self.sb.admin.from_("invite_links")
            .select("id, group_id, is_active")
            .eq("id", id)
        )
        if not invite:
            raise HTTPException(404, f"Invite link {id} not found")

        self.assert_group_admin(invite["group_id"], user_id)

        res = (
            self.sb.admin.from_("invite_links")
            .update({"is_active": False})
            .eq("id", id)
            .execute()
        )
        return res.data[0]

    def redeem(self, token: str, user_id: str) -> dict:
        invite = maybe_single(
            self.sb.admin.from_("invite_links")
            .select("*, groups(id, name, description, photo_url, status)")
            .eq("token", token)
        )
        if not invite:
            raise HTTPException(404, "Invite link not found or invalid")
        if not invite.get("is_active"):
            raise HTTPException(400, "This invite link has been revoked")
        if invite.get("expires_at") and datetime.fromisoformat(
            invite["expires_at"].replace("Z", "+00:00")
        ) < datetime.now(timezone.utc):
            raise HTTPException(400, "This invite link has expired")
        if (
            invite.get("max_uses") is not None
            and invite.get("use_count", 0) >= invite["max_uses"]
        ):
            raise HTTPException(
                400, "This invite link has reached its maximum uses"
            )

        # Check if user is already a member
        existing_member = maybe_single(
            self.sb.admin.from_("group_members")
            .select("id")
            .eq("group_id", invite["group_id"])
            .eq("user_id", user_id)
        )
        if existing_member:
            raise HTTPException(400, "You are already a member of this group")

        # Insert group_members row
        self.sb.admin.from_("group_members").insert(
            {
                "group_id": invite["group_id"],
                "user_id": user_id,
                "group_role": "member",
            }
        ).execute()

        # Increment use_count
        self.sb.admin.from_("invite_links").update(
            {"use_count": (invite.get("use_count") or 0) + 1}
        ).eq("id", invite["id"]).execute()

        return {
            "message": "Successfully joined the group",
            "group": invite.get("groups"),
        }

    def assert_group_admin(self, group_id: str, user_id: str) -> None:
        """Asserts the requester is admin_id OR has group_role='admin'."""
        group = maybe_single(
            self.sb.admin.from_("groups").select("admin_id").eq("id", group_id)
        )
        if not group:
            raise HTTPException(404, f"Group {group_id} not found")
        if group.get("admin_id") == user_id:
            return

        membership = maybe_single(
            self.sb.admin.from_("group_members")
            .select("group_role")
            .eq("group_id", group_id)
            .eq("user_id", user_id)
        )
        if not membership or membership.get("group_role") != "admin":
            raise HTTPException(403, "You are not an admin of this group")
