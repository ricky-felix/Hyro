"""Groups service — port of ``src/groups/groups.service.ts``."""
import calendar
from datetime import date, datetime, timedelta

from fastapi import HTTPException

from ..common.types import Frequency
from ..db import fetch_all, maybe_single, supabase
from .schemas import CreateGroupDto, UpdateGroupDto


def _parse_date(value: str) -> date:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).date()


def _js_add_month(d: date) -> date:
    """Mirror JS ``Date.setMonth(getMonth()+1)`` including day overflow rollover."""
    month0 = (d.month - 1) + 1
    year = d.year + month0 // 12
    month = month0 % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    if d.day <= last_day:
        return date(year, month, d.day)
    overflow = d.day - last_day
    base = date(year, month, last_day)
    return base + timedelta(days=overflow)


class GroupsService:
    def __init__(self) -> None:
        self.sb = supabase

    def find_all_for_user(self, user_id: str) -> list:
        return fetch_all(
            self.sb.admin.from_("groups")
            .select("*, group_members!inner(user_id, group_role)")
            .eq("group_members.user_id", user_id)
            .order("created_at", desc=True)
        )

    def find_one(self, group_id: str) -> dict:
        data = maybe_single(
            self.sb.admin.from_("groups")
            .select(
                "*, group_members(id, user_id, group_role, giliran_order, joined_at)"
            )
            .eq("id", group_id)
        )
        if not data:
            raise HTTPException(404, f"Group {group_id} not found")
        return data

    def create(self, dto: CreateGroupDto, user_id: str) -> dict:
        res = (
            self.sb.admin.from_("groups")
            .insert(
                {
                    "name": dto.name,
                    "description": dto.description,
                    "photo_url": dto.photo_url,
                    "amount_per_round": dto.amount_per_round,
                    "frequency": dto.frequency,
                    "giliran_method": dto.giliran_method,
                    "start_date": dto.start_date,
                    "total_rounds": dto.total_rounds,
                    "admin_id": user_id,
                    "status": "active",
                }
            )
            .execute()
        )
        group = res.data[0]

        # Insert creator as group admin member
        self.sb.admin.from_("group_members").insert(
            {"group_id": group["id"], "user_id": user_id, "group_role": "admin"}
        ).execute()

        # Scaffold rounds when giliran_method is 'random'
        if dto.giliran_method == "random":
            self._scaffold_rounds(
                group["id"], dto.total_rounds, dto.start_date, dto.frequency
            )

        return group

    def update(self, group_id: str, dto: UpdateGroupDto, user_id: str) -> dict:
        self.assert_group_admin(group_id, user_id)
        res = (
            self.sb.admin.from_("groups")
            .update(dto.model_dump(exclude_unset=True))
            .eq("id", group_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(404, f"Group {group_id} not found")
        return res.data[0]

    def remove(self, group_id: str, user_id: str) -> dict:
        group = maybe_single(
            self.sb.admin.from_("groups").select("admin_id").eq("id", group_id)
        )
        if not group:
            raise HTTPException(404, f"Group {group_id} not found")
        if group["admin_id"] != user_id:
            raise HTTPException(403, "Only the group creator can delete this group")

        self.sb.admin.from_("groups").delete().eq("id", group_id).execute()
        return {"message": "Group deleted successfully"}

    def assert_group_admin(self, group_id: str, user_id: str) -> None:
        """Asserts the requester is admin_id OR has group_role='admin'."""
        group = maybe_single(
            self.sb.admin.from_("groups").select("admin_id").eq("id", group_id)
        )
        if not group:
            raise HTTPException(404, f"Group {group_id} not found")
        if group["admin_id"] == user_id:
            return

        membership = maybe_single(
            self.sb.admin.from_("group_members")
            .select("group_role")
            .eq("group_id", group_id)
            .eq("user_id", user_id)
        )
        if not membership or membership.get("group_role") != "admin":
            raise HTTPException(403, "You are not an admin of this group")

    def _scaffold_rounds(
        self, group_id: str, total_rounds: int, start_date: str, frequency: Frequency
    ) -> None:
        rounds = []
        current = _parse_date(start_date)

        for i in range(1, total_rounds + 1):
            rounds.append(
                {
                    "group_id": group_id,
                    "round_number": i,
                    "scheduled_date": current.isoformat(),
                    "status": "upcoming",
                }
            )
            if frequency == "weekly":
                current = current + timedelta(days=7)
            else:
                current = _js_add_month(current)

        self.sb.admin.from_("rounds").insert(rounds).execute()
