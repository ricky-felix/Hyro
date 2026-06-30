"""Rounds service — port of ``src/rounds/rounds.service.ts``."""
from fastapi import HTTPException

from ..common.utils import iso_now
from ..db import fetch_all, maybe_single, supabase


class RoundsService:
    def __init__(self) -> None:
        self.sb = supabase

    def list_for_group(self, group_id: str) -> list:
        res = (
            self.sb.admin.from_("rounds")
            .select("*")
            .eq("group_id", group_id)
            .order("round_number", desc=False)
            .execute()
        )
        return res.data or []

    def find_one(self, id: str) -> dict:
        data = maybe_single(
            self.sb.admin.from_("rounds").select("*").eq("id", id)
        )
        if not data:
            raise HTTPException(404, f"Round {id} not found")
        return data

    def set_recipient(
        self, round_id: str, recipient_id: str, requester_id: str
    ) -> dict:
        round_ = self.find_one(round_id)
        self.assert_group_admin(round_["group_id"], requester_id)

        res = (
            self.sb.admin.from_("rounds")
            .update({"recipient_id": recipient_id})
            .eq("id", round_id)
            .execute()
        )
        return res.data[0]

    def activate(self, round_id: str, requester_id: str) -> dict:
        round_ = self.find_one(round_id)
        self.assert_group_admin(round_["group_id"], requester_id)

        if round_["status"] != "upcoming":
            raise HTTPException(
                400,
                f"Round cannot be activated — current status is '{round_['status']}'",
            )

        res = (
            self.sb.admin.from_("rounds")
            .update({"status": "active"})
            .eq("id", round_id)
            .execute()
        )
        data = res.data[0]

        # Mark the group as active if it is still pending
        self.sb.admin.from_("groups").update({"status": "active"}).eq(
            "id", round_["group_id"]
        ).eq("status", "pending").execute()

        return data

    def complete(self, round_id: str, requester_id: str) -> dict:
        round_ = self.find_one(round_id)
        self.assert_group_admin(round_["group_id"], requester_id)

        if round_["status"] != "active":
            raise HTTPException(
                400,
                f"Round cannot be completed — current status is '{round_['status']}'",
            )

        completed_at = iso_now()

        res = (
            self.sb.admin.from_("rounds")
            .update({"status": "completed", "completed_at": completed_at})
            .eq("id", round_id)
            .execute()
        )
        data = res.data[0]

        # Check if this was the last round and auto-complete the group
        remaining = (
            self.sb.admin.from_("rounds")
            .select("id")
            .eq("group_id", round_["group_id"])
            .neq("status", "completed")
            .execute()
        )
        if not remaining.data:
            self.sb.admin.from_("groups").update({"status": "completed"}).eq(
                "id", round_["group_id"]
            ).execute()

        return data

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
