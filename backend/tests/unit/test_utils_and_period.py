"""Tests for time helpers and the plan-period month key."""
import re

from app.common.utils import iso_now
from app.deps import _current_period_month


def test_iso_now_has_trailing_z():
    s = iso_now()
    # e.g. 2026-06-29T09:19:23.656Z
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z", s)


def test_current_period_month_is_first_of_month():
    s = _current_period_month()
    assert re.fullmatch(r"\d{4}-\d{2}-01", s)
