"""Faithful port of ``src/bills/strategies/split-strategies.spec.ts``."""
import pytest
from fastapi import HTTPException

from app.bills.strategies import (
    equal_split,
    exact_split,
    get_strategy,
    percentage_split,
    shares_split,
)


def _sum_owed(rows):
    return sum(r["amount_owed"] for r in rows)


# ── EqualSplitStrategy ───────────────────────────────────────────
def test_equal_divides_evenly_when_divisible():
    participants = [{"user_id": "A"}, {"user_id": "B"}, {"user_id": "C"}, {"user_id": "D"}]
    res = equal_split(100_000, participants, "A")
    assert [r["amount_owed"] for r in res] == [25_000, 25_000, 25_000, 25_000]
    assert _sum_owed(res) == 100_000


def test_equal_distributes_remainder_to_first():
    participants = [{"user_id": "A"}, {"user_id": "B"}, {"user_id": "C"}]
    res = equal_split(100, participants, "B")
    assert [r["amount_owed"] for r in res] == [34, 33, 33]
    assert _sum_owed(res) == 100


def test_equal_flags_payer():
    participants = [{"user_id": "A"}, {"user_id": "B"}]
    res = equal_split(50_000, participants, "B")
    assert next(r for r in res if r["user_id"] == "B")["is_payer"] is True
    assert next(r for r in res if r["user_id"] == "A")["is_payer"] is False


# ── ExactSplitStrategy ───────────────────────────────────────────
def test_exact_returns_amounts_when_sum_matches():
    participants = [
        {"user_id": "A", "exact_amount": 30_000},
        {"user_id": "B", "exact_amount": 70_000},
    ]
    res = exact_split(100_000, participants, "A")
    assert [r["amount_owed"] for r in res] == [30_000, 70_000]


def test_exact_throws_when_sum_mismatch():
    participants = [
        {"user_id": "A", "exact_amount": 20_000},
        {"user_id": "B", "exact_amount": 70_000},
    ]
    with pytest.raises(HTTPException):
        exact_split(100_000, participants, "A")


def test_exact_throws_when_missing_amount():
    participants = [{"user_id": "A", "exact_amount": 50_000}, {"user_id": "B"}]
    with pytest.raises(HTTPException):
        exact_split(100_000, participants, "A")


# ── PercentageSplitStrategy ──────────────────────────────────────
def test_percentage_computes_and_sums():
    participants = [
        {"user_id": "A", "percentage": 25},
        {"user_id": "B", "percentage": 25},
        {"user_id": "C", "percentage": 50},
    ]
    res = percentage_split(100_000, participants, "C")
    assert [r["amount_owed"] for r in res] == [25_000, 25_000, 50_000]


def test_percentage_absorbs_rounding_on_last():
    participants = [
        {"user_id": "A", "percentage": 33.33},
        {"user_id": "B", "percentage": 33.33},
        {"user_id": "C", "percentage": 33.34},
    ]
    res = percentage_split(100, participants, "A")
    assert _sum_owed(res) == 100


def test_percentage_throws_when_not_100():
    participants = [
        {"user_id": "A", "percentage": 50},
        {"user_id": "B", "percentage": 25},
    ]
    with pytest.raises(HTTPException):
        percentage_split(100_000, participants, "A")


def test_percentage_throws_when_missing():
    participants = [{"user_id": "A", "percentage": 50}, {"user_id": "B"}]
    with pytest.raises(HTTPException):
        percentage_split(100_000, participants, "A")


# ── SharesSplitStrategy ──────────────────────────────────────────
def test_shares_treats_missing_as_one():
    participants = [{"user_id": "A"}, {"user_id": "B"}]
    res = shares_split(100_000, participants, "A")
    assert [r["amount_owed"] for r in res] == [50_000, 50_000]


def test_shares_divides_proportionally():
    participants = [{"user_id": "A", "shares": 1}, {"user_id": "B", "shares": 3}]
    res = shares_split(100_000, participants, "A")
    assert [r["amount_owed"] for r in res] == [25_000, 75_000]
    assert _sum_owed(res) == 100_000


def test_shares_distributes_remainder_to_first():
    participants = [
        {"user_id": "A", "shares": 1},
        {"user_id": "B", "shares": 1},
        {"user_id": "C", "shares": 1},
    ]
    res = shares_split(100, participants, "A")
    assert [r["amount_owed"] for r in res] == [34, 33, 33]
    assert _sum_owed(res) == 100


# ── getStrategy factory ──────────────────────────────────────────
def test_factory_resolves_each_method():
    assert get_strategy("equal") is equal_split
    assert get_strategy("exact") is exact_split
    assert get_strategy("percentage") is percentage_split
    assert get_strategy("shares") is shares_split


def test_factory_throws_on_unknown():
    with pytest.raises(HTTPException):
        get_strategy("mystery")
