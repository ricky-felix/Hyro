"""Group-members service — port of ``src/group-members/group-members.service.ts``."""
import random

from fastapi import HTTPException

from ..db import fetch_all, maybe_single, supabase
from .schemas import AddMemberDto, AssignGiliranDto


class GroupMembersService:
    def __init__(self) -> None:
        self.sb = supabase

    def list_for_group(self, group_id: str) -> list:
        res = (
            self.sb.admin.from_("group_members")
            .select("id, group_id, user_id, giliran_order, group_role, joined_at")
            .eq("group_id", group_id)
            .order("giliran_order", desc=False, nulls_first=False)
            .execute()
        )
        return res.data or []

    def add_member(self, group_id: str, dto: AddMemberDto, requester_id: str) -> dict:
        self.assert_group_admin(group_id, requester_id)

        try:
            res = (
                self.sb.admin.from_("group_members")
                .insert(
                    {
                        "group_id": group_id,
                        "user_id": dto.user_id,
                        "group_role": dto.group_role or "member",
                    }
                )
                .execute()
            )
        except Exception as e:
            # PostgreSQL unique-violation code 23505
            if "23505" in str(e):
                raise HTTPException(400, "User is already a member of this group")
            raise

        return res.data[0]

    def remove_member(
        self, group_id: str, user_id: str, requester_id: str
    ) -> dict:
        self.assert_group_admin(group_id, requester_id)

        # Prevent removing the primary admin
        group = maybe_single(
            self.sb.admin.from_("groups").select("admin_id").eq("id", group_id)
        )
        if group and group.get("admin_id") == user_id:
            raise HTTPException(403, "Cannot remove the group creator from the group")

        self.sb.admin.from_("group_members").delete().eq(
            "group_id", group_id
        ).eq("user_id", user_id).execute()

        return {"message": "Member removed successfully"}

    def assign_giliran_order(
        self, group_id: str, dto: AssignGiliranDto, requester_id: str
    ) -> list:
        self.assert_group_admin(group_id, requester_id)

        group = maybe_single(
            self.sb.admin.from_("groups")
            .select("giliran_method")
            .eq("id", group_id)
        )
        if not group:
            raise HTTPException(404, f"Group {group_id} not found")

        # Validate no duplicate giliran_order values
        orders = [a.giliran_order for a in dto.assignments]
        if len(set(orders)) != len(orders):
            raise HTTPException(400, "Duplicate giliran_order values are not allowed")

        # Update each member's giliran_order individually to respect the UNIQUE constraint
        for assignment in dto.assignments:
            self.sb.admin.from_("group_members").update(
                {"giliran_order": assignment.giliran_order}
            ).eq("group_id", group_id).eq(
                "user_id", assignment.user_id
            ).execute()

        return self.list_for_group(group_id)

    def random_shuffle(self, group_id: str, requester_id: str) -> list:
        self.assert_group_admin(group_id, requester_id)

        res = (
            self.sb.admin.from_("group_members")
            .select("user_id")
            .eq("group_id", group_id)
            .execute()
        )
        members = res.data or []
        if not members:
            raise HTTPException(400, "No members found in this group")

        # Fisher-Yates shuffle to generate random unique order
        indices = list(range(1, len(members) + 1))
        random.shuffle(indices)

        # First clear all giliran_orders to avoid unique constraint conflicts
        self.sb.admin.from_("group_members").update(
            {"giliran_order": None}
        ).eq("group_id", group_id).execute()

        for i, member in enumerate(members):
            self.sb.admin.from_("group_members").update(
                {"giliran_order": indices[i]}
            ).eq("group_id", group_id).eq(
                "user_id", member["user_id"]
            ).execute()

        return self.list_for_group(group_id)

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
