"""Unit tests for GroupsService.update's per-field last-write-wins logic.

An admin's settings edit, queued offline, carries a `base_snapshot` of the
fields it's changing as they looked when the edit started. On sync, if the
server's current value for a field differs from that baseline, someone else
changed it first — the server's value wins for that field and it's reported
in `overridden_fields` so the UI can tell the user.
"""
import pytest
from fastapi import HTTPException

from app.db import supabase as sb_singleton
from app.groups.schemas import UpdateGroupDto
from app.groups.service import GroupsService

from _fake_seq import install

GROUP_ID = "00000000-0000-0000-0000-0000000000a1"
ADMIN_ID = "00000000-0000-0000-0000-0000000000b1"


def test_update_without_base_snapshot_behaves_as_plain_update():
    previous, fake = install(
        sb_singleton,
        [
            ("groups", {"admin_id": ADMIN_ID}),  # assert_group_admin
            ("groups", [{"id": GROUP_ID, "name": "New Name"}]),  # update
        ],
    )
    try:
        svc = GroupsService()
        dto = UpdateGroupDto(name="New Name")
        result = svc.update(GROUP_ID, dto, ADMIN_ID)
        assert result["name"] == "New Name"
        assert result["overridden_fields"] == []
        fake.assert_exhausted()
    finally:
        sb_singleton._admin = previous


def test_update_with_matching_baseline_applies_the_field():
    previous, fake = install(
        sb_singleton,
        [
            ("groups", {"admin_id": ADMIN_ID}),  # assert_group_admin
            ("groups", {"name": "Old Name"}),  # baseline check — matches
            ("groups", [{"id": GROUP_ID, "name": "New Name"}]),  # update
        ],
    )
    try:
        svc = GroupsService()
        dto = UpdateGroupDto(name="New Name", base_snapshot={"name": "Old Name"})
        result = svc.update(GROUP_ID, dto, ADMIN_ID)
        assert result["name"] == "New Name"
        assert result["overridden_fields"] == []
        fake.assert_exhausted()
    finally:
        sb_singleton._admin = previous


def test_update_with_stale_baseline_drops_and_reports_the_field():
    """Someone else already changed `name` since this client's baseline —
    the client's change to `name` must be dropped, not silently applied on
    top, and the server's current value returned instead."""
    previous, fake = install(
        sb_singleton,
        [
            ("groups", {"admin_id": ADMIN_ID}),  # assert_group_admin
            ("groups", {"name": "Someone Else's Edit"}),  # baseline check — mismatch
            ("groups", {"id": GROUP_ID, "name": "Someone Else's Edit"}),  # re-select (no-op update)
        ],
    )
    try:
        svc = GroupsService()
        dto = UpdateGroupDto(name="New Name", base_snapshot={"name": "Old Name"})
        result = svc.update(GROUP_ID, dto, ADMIN_ID)
        assert result["name"] == "Someone Else's Edit"
        assert result["overridden_fields"] == ["name"]
        fake.assert_exhausted()
    finally:
        sb_singleton._admin = previous


def test_update_with_partial_override_applies_untouched_fields():
    """Two fields changed; only one collides with someone else's edit — the
    other must still go through."""
    previous, fake = install(
        sb_singleton,
        [
            ("groups", {"admin_id": ADMIN_ID}),
            ("groups", {"name": "Someone Else's Edit", "description": "Old Desc"}),
            ("groups", [{"id": GROUP_ID, "name": "Someone Else's Edit", "description": "New Desc"}]),
        ],
    )
    try:
        svc = GroupsService()
        dto = UpdateGroupDto(
            name="New Name",
            description="New Desc",
            base_snapshot={"name": "Old Name", "description": "Old Desc"},
        )
        result = svc.update(GROUP_ID, dto, ADMIN_ID)
        assert result["description"] == "New Desc"
        assert result["overridden_fields"] == ["name"]
        fake.assert_exhausted()
    finally:
        sb_singleton._admin = previous


def test_update_rejects_non_admin():
    previous, fake = install(
        sb_singleton,
        [
            ("groups", {"admin_id": ADMIN_ID}),  # assert_group_admin: not the admin_id
            ("group_members", None),  # membership lookup: not a member either
        ],
    )
    try:
        svc = GroupsService()
        dto = UpdateGroupDto(name="New Name")
        with pytest.raises(HTTPException) as exc_info:
            svc.update(GROUP_ID, dto, "someone-else")
        assert exc_info.value.status_code == 403
        fake.assert_exhausted()
    finally:
        sb_singleton._admin = previous
