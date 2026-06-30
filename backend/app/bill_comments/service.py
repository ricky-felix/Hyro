"""Bill-comments service — port of ``src/bill-comments/bill-comments.service.ts``."""
from typing import List

from fastapi import HTTPException

from ..common.utils import iso_now
from ..db import maybe_single, supabase
from .schemas import CreateCommentDto, UpdateCommentDto


class BillCommentsService:
    def __init__(self) -> None:
        self.sb = supabase

    # ── LIST FOR BILL (threaded, exclude soft-deleted) ────────────────
    def list_for_bill(self, bill_id: str, user_id: str) -> list:
        self._require_bill_access(bill_id, user_id)

        try:
            res = (
                self.sb.admin.from_("bill_comments")
                .select("*")
                .eq("bill_id", bill_id)
                .is_("deleted_at", "null")
                .order("created_at", desc=False)
                .execute()
            )
        except Exception as e:
            raise HTTPException(400, str(e))

        return self._build_threaded(res.data or [])

    # ── CREATE ───────────────────────────────────────────────────────
    def create(self, dto: CreateCommentDto, user_id: str) -> dict:
        self._require_bill_access(dto.bill_id, user_id)

        if dto.parent_id:
            parent = maybe_single(
                self.sb.admin.from_("bill_comments")
                .select("id, bill_id, deleted_at")
                .eq("id", dto.parent_id)
            )
            if not parent or parent.get("bill_id") != dto.bill_id:
                raise HTTPException(
                    404,
                    f"Parent comment {dto.parent_id} not found in bill {dto.bill_id}",
                )
            if parent.get("deleted_at"):
                raise HTTPException(400, "Cannot reply to a deleted comment")

        try:
            res = (
                self.sb.admin.from_("bill_comments")
                .insert(
                    {
                        "bill_id": dto.bill_id,
                        "user_id": user_id,
                        "body": dto.body,
                        "parent_id": dto.parent_id,
                    }
                )
                .execute()
            )
        except Exception as e:
            raise HTTPException(400, str(e))

        return res.data[0]

    # ── UPDATE ───────────────────────────────────────────────────────
    def update(self, id: str, dto: UpdateCommentDto, user_id: str) -> dict:
        comment = self._require_comment(id)

        if comment["user_id"] != user_id:
            raise HTTPException(403, "You can only edit your own comments")

        if comment.get("deleted_at"):
            raise HTTPException(400, "Cannot edit a deleted comment")

        try:
            res = (
                self.sb.admin.from_("bill_comments")
                .update({"body": dto.body, "updated_at": iso_now()})
                .eq("id", id)
                .execute()
            )
        except Exception as e:
            raise HTTPException(400, str(e))

        return res.data[0]

    # ── SOFT DELETE ──────────────────────────────────────────────────
    def soft_delete(self, id: str, user_id: str) -> dict:
        comment = self._require_comment(id)

        if comment["user_id"] != user_id:
            raise HTTPException(403, "You can only delete your own comments")

        if comment.get("deleted_at"):
            raise HTTPException(400, "Comment is already deleted")

        try:
            res = (
                self.sb.admin.from_("bill_comments")
                .update({"deleted_at": iso_now()})
                .eq("id", id)
                .execute()
            )
        except Exception as e:
            raise HTTPException(400, str(e))

        return res.data[0]

    # ── Private helpers ───────────────────────────────────────────────
    def _require_bill_access(self, bill_id: str, user_id: str) -> None:
        bill = maybe_single(
            self.sb.admin.from_("bills").select("paid_by").eq("id", bill_id)
        )
        if not bill:
            raise HTTPException(404, f"Bill {bill_id} not found")

        if bill["paid_by"] == user_id:
            return

        participant = maybe_single(
            self.sb.admin.from_("bill_participants")
            .select("id")
            .eq("bill_id", bill_id)
            .eq("user_id", user_id)
        )
        if not participant:
            raise HTTPException(403, "You are not a participant of this bill")

    def _require_comment(self, id: str) -> dict:
        data = maybe_single(
            self.sb.admin.from_("bill_comments").select("*").eq("id", id)
        )
        if not data:
            raise HTTPException(404, f"Comment {id} not found")
        return data

    def _build_threaded(self, rows: List[dict]) -> List[dict]:
        """Build a threaded comment structure (top-level with nested replies)."""
        node_map: dict = {}
        roots: list = []

        for row in rows:
            node_map[row["id"]] = {**row, "replies": []}

        for row in rows:
            node = node_map[row["id"]]
            parent_id = row.get("parent_id")
            if parent_id:
                parent = node_map.get(parent_id)
                if parent:
                    parent["replies"].append(node)
                else:
                    # Orphaned reply — include at root
                    roots.append(node)
            else:
                roots.append(node)

        return roots
