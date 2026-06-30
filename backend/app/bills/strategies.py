"""Bill split strategies — ports of ``src/bills/strategies/*``.

Each strategy computes how a total is divided across participants. Input
participants are dicts with keys: ``user_id`` and optional ``shares`` /
``percentage`` / ``exact_amount``. Results are dicts: ``user_id``,
``amount_owed``, ``is_payer``.
"""
import math
from typing import List

from fastapi import HTTPException


def _js_round(x: float) -> int:
    """Match JS ``Math.round`` (round half up, not banker's rounding)."""
    return math.floor(x + 0.5)


def equal_split(total_amount: int, participants: List[dict], payer_id: str) -> List[dict]:
    n = len(participants)
    base = total_amount // n
    remainder = total_amount - base * n
    return [
        {
            "user_id": p["user_id"],
            "amount_owed": base + 1 if index < remainder else base,
            "is_payer": p["user_id"] == payer_id,
        }
        for index, p in enumerate(participants)
    ]


def exact_split(total_amount: int, participants: List[dict], payer_id: str) -> List[dict]:
    total = 0
    for p in participants:
        if p.get("exact_amount") is None:
            raise HTTPException(
                400,
                f"Participant {p['user_id']} is missing exact_amount for split method 'exact'",
            )
        total += p["exact_amount"]

    if total != total_amount:
        raise HTTPException(
            400,
            f"Sum of exact amounts ({total}) does not equal total_amount ({total_amount})",
        )

    return [
        {
            "user_id": p["user_id"],
            "amount_owed": p["exact_amount"],
            "is_payer": p["user_id"] == payer_id,
        }
        for p in participants
    ]


def percentage_split(total_amount: int, participants: List[dict], payer_id: str) -> List[dict]:
    total_pct = 0.0
    for p in participants:
        if p.get("percentage") is None:
            raise HTTPException(
                400,
                f"Participant {p['user_id']} is missing percentage for split method 'percentage'",
            )
        total_pct += p["percentage"]

    if abs(total_pct - 100) > 0.01:
        raise HTTPException(400, f"Percentages must sum to 100 (got {total_pct})")

    results = [
        {
            "user_id": p["user_id"],
            "amount_owed": _js_round(total_amount * p["percentage"] / 100),
            "is_payer": p["user_id"] == payer_id,
        }
        for p in participants
    ]

    computed = sum(r["amount_owed"] for r in results)
    diff = total_amount - computed
    if diff != 0:
        results[-1]["amount_owed"] += diff

    return results


def shares_split(total_amount: int, participants: List[dict], payer_id: str) -> List[dict]:
    shares_arr = [p.get("shares") or 1 for p in participants]
    total_shares = sum(shares_arr)

    distributed = 0
    amounts = []
    for s in shares_arr:
        amount = (total_amount * s) // total_shares
        distributed += amount
        amounts.append(amount)

    # Distribute rounding remainder rupiah-by-rupiah from the front
    remainder = total_amount - distributed
    i = 0
    while remainder > 0:
        amounts[i] += 1
        i += 1
        remainder -= 1

    return [
        {
            "user_id": p["user_id"],
            "amount_owed": amounts[index],
            "is_payer": p["user_id"] == payer_id,
        }
        for index, p in enumerate(participants)
    ]


_STRATEGY_REGISTRY = {
    "equal": equal_split,
    "exact": exact_split,
    "percentage": percentage_split,
    "shares": shares_split,
}


def get_strategy(method: str):
    strategy = _STRATEGY_REGISTRY.get(method)
    if strategy is None:
        raise HTTPException(400, f"Unknown split method: {method}")
    return strategy
