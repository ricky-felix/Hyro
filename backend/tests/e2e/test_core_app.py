"""Core app behaviour: health, auth guard, validation parity, webhook signatures.

Mirrors the cross-cutting assertions spread across the TS e2e specs.
"""
import hashlib

from tests.conftest import ADMIN_TOKEN, VALID_TOKEN


def test_health_ok(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["timestamp"].endswith("Z")


# ── Auth guard ───────────────────────────────────────────────────
def test_protected_route_401_without_token(client):
    assert client.get("/api/groups").status_code == 401


def test_protected_route_401_with_wrong_prefix(client):
    res = client.get("/api/groups", headers={"Authorization": "Basic badtoken"})
    assert res.status_code == 401


def test_protected_route_401_with_invalid_token(client):
    res = client.get("/api/groups", headers={"Authorization": "Bearer nope"})
    assert res.status_code == 401


def test_protected_route_under_500_with_valid_token(client, auth_headers):
    # Mocked Supabase returns empty data — handler must not 5xx.
    assert client.get("/api/groups", headers=auth_headers).status_code < 500


# ── Validation parity (NestJS ValidationPipe → 400, not 422) ─────
def test_post_groups_400_on_empty_body(client, auth_headers):
    assert client.post("/api/groups", headers=auth_headers, json={}).status_code == 400


def test_post_groups_400_on_short_name(client, auth_headers):
    res = client.post(
        "/api/groups",
        headers=auth_headers,
        json={
            "name": "AB",
            "amount_per_round": 500000,
            "frequency": "monthly",
            "giliran_method": "random",
            "start_date": "2026-01-01",
            "total_rounds": 12,
        },
    )
    assert res.status_code == 400


def test_post_groups_400_on_invalid_frequency(client, auth_headers):
    res = client.post(
        "/api/groups",
        headers=auth_headers,
        json={
            "name": "Valid Name",
            "amount_per_round": 500000,
            "frequency": "daily",
            "giliran_method": "random",
            "start_date": "2026-01-01",
            "total_rounds": 12,
        },
    )
    assert res.status_code == 400


# ── Public routes (no auth) ──────────────────────────────────────
def test_plans_list_is_public(client):
    # Public route: must not be 401. (May 5xx without a real DB; assert not 401.)
    assert client.get("/api/plans").status_code != 401


# ── Webhook signature validation ─────────────────────────────────
def test_xendit_webhook_rejects_bad_token(client):
    res = client.post(
        "/webhooks/xendit",
        json={"event": "invoice.paid", "external_id": "x", "status": "PAID"},
        headers={"x-callback-token": "wrong"},
    )
    assert res.status_code == 401


def test_xendit_webhook_accepts_valid_token(client):
    res = client.post(
        "/webhooks/xendit",
        json={"event": "invoice.paid", "external_id": "tx_1", "status": "PAID"},
        headers={"x-callback-token": "test-xendit-token"},
    )
    assert res.status_code == 200
    assert res.json() == {"received": True}


def test_midtrans_webhook_rejects_bad_signature(client):
    res = client.post(
        "/webhooks/midtrans",
        json={
            "order_id": "x",
            "status_code": "200",
            "gross_amount": "1000",
            "signature_key": "bad",
            "transaction_status": "settlement",
        },
    )
    assert res.status_code == 401


def test_midtrans_webhook_accepts_valid_signature(client):
    order_id, status_code, gross = "tx_1", "200", "1000.00"
    server_key = "test-midtrans-key"
    sig = hashlib.sha512(
        f"{order_id}{status_code}{gross}{server_key}".encode()
    ).hexdigest()
    res = client.post(
        "/webhooks/midtrans",
        json={
            "order_id": order_id,
            "status_code": status_code,
            "gross_amount": gross,
            "signature_key": sig,
            "transaction_status": "settlement",
        },
    )
    assert res.status_code == 200
    assert res.json() == {"received": True}
