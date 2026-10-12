"""Unit tests for PaymentsService.create's offline-retry idempotency.

The offline outbox resubmits a contribution with the same client-generated
UUID when it can't tell whether an earlier attempt actually landed (flaky
network, app killed mid-request, etc). These tests assert a retry never
double-counts: it finds the existing row and returns it rather than
inserting again or raising a scary constraint error.
"""
import pytest
from fastapi import HTTPException

from app.db import supabase as sb_singleton
from app.payments.schemas import CreatePaymentDto
from app.payments.service import PaymentsService

from _fake_seq import install

ROUND_ID = "00000000-0000-0000-0000-0000000000a1"
GROUP_ID = "00000000-0000-0000-0000-0000000000b1"
USER_ID = "00000000-0000-0000-0000-0000000000c1"
CLIENT_ID = "00000000-0000-0000-0000-0000000000d1"

ROUND_ROW = {"id": ROUND_ID, "group_id": GROUP_ID}


@pytest.fixture(autouse=True)
def _restore_admin():
    yield
    # Each test installs its own fake via install(); nothing to do here,
    # but keep the fixture so failures don't leak state across the file.


def test_create_without_client_id_behaves_as_before():
    previous, fake = install(
        sb_singleton,
        [
            ("rounds", ROUND_ROW),
            ("payments", [{"id": "server-generated-id", "round_id": ROUND_ID}]),
        ],
    )
    try:
        svc = PaymentsService()
        dto = CreatePaymentDto(round_id=ROUND_ID, amount=50000)
        result = svc.create(dto, USER_ID)
        assert result["id"] == "server-generated-id"
        fake.assert_exhausted()
    finally:
        sb_singleton._admin = previous


def test_create_with_client_id_first_attempt_inserts():
    previous, fake = install(
        sb_singleton,
        [
            ("rounds", ROUND_ROW),
            ("payments", None),  # existing-by-id check: not found yet
            ("payments", [{"id": CLIENT_ID, "round_id": ROUND_ID, "amount": 50000}]),
        ],
    )
    try:
        svc = PaymentsService()
        dto = CreatePaymentDto(id=CLIENT_ID, round_id=ROUND_ID, amount=50000)
        result = svc.create(dto, USER_ID)
        assert result["id"] == CLIENT_ID
        fake.assert_exhausted()
    finally:
        sb_singleton._admin = previous


def test_create_with_client_id_retry_short_circuits_without_inserting():
    """Second call with the same client id — the row already exists, so the
    service must return it WITHOUT attempting another insert."""
    previous, fake = install(
        sb_singleton,
        [
            ("rounds", ROUND_ROW),
            ("payments", {"id": CLIENT_ID, "round_id": ROUND_ID, "amount": 50000, "status": "pending"}),
        ],
    )
    try:
        svc = PaymentsService()
        dto = CreatePaymentDto(id=CLIENT_ID, round_id=ROUND_ID, amount=50000)
        result = svc.create(dto, USER_ID)
        assert result["id"] == CLIENT_ID
        assert result["status"] == "pending"
        # Exactly 2 calls consumed (rounds, payments-existing-check) — no insert call.
        fake.assert_exhausted()
    finally:
        sb_singleton._admin = previous


def test_create_with_client_id_race_on_insert_refetches_existing():
    """Two near-simultaneous retries both see 'not found' then both try to
    insert — the loser hits a PK conflict and must re-fetch and return the
    winner's row instead of erroring."""
    previous, fake = install(
        sb_singleton,
        [
            ("rounds", ROUND_ROW),
            ("payments", None),  # existing-by-id check: not found (raced)
            ("payments", Exception("duplicate key value violates unique constraint (23505)")),
            ("payments", {"id": CLIENT_ID, "round_id": ROUND_ID, "amount": 50000}),  # re-fetch
        ],
    )
    try:
        svc = PaymentsService()
        dto = CreatePaymentDto(id=CLIENT_ID, round_id=ROUND_ID, amount=50000)
        result = svc.create(dto, USER_ID)
        assert result["id"] == CLIENT_ID
        fake.assert_exhausted()
    finally:
        sb_singleton._admin = previous


def test_create_duplicate_round_payer_without_client_id_raises_400():
    """A genuine second contribution attempt for a round the payer already
    paid — the UNIQUE(round_id, payer_id) constraint fires. No client id to
    retry against, so this must surface as a clear, non-retryable 400."""
    previous, fake = install(
        sb_singleton,
        [
            ("rounds", ROUND_ROW),
            ("payments", Exception("duplicate key value violates unique constraint (23505)")),
        ],
    )
    try:
        svc = PaymentsService()
        dto = CreatePaymentDto(round_id=ROUND_ID, amount=50000)
        with pytest.raises(HTTPException) as exc_info:
            svc.create(dto, USER_ID)
        assert exc_info.value.status_code == 400
        fake.assert_exhausted()
    finally:
        sb_singleton._admin = previous


def test_create_round_not_found_raises_404():
    previous, fake = install(sb_singleton, [("rounds", None)])
    try:
        svc = PaymentsService()
        dto = CreatePaymentDto(round_id=ROUND_ID, amount=50000)
        with pytest.raises(HTTPException) as exc_info:
            svc.create(dto, USER_ID)
        assert exc_info.value.status_code == 404
        fake.assert_exhausted()
    finally:
        sb_singleton._admin = previous
