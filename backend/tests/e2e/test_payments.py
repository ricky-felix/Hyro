"""Payments e2e tests — port of test/payments.e2e-spec.ts."""


# ── Auth guard ────────────────────────────────────────────────────────────

def test_get_payments_me_401_without_token(client):
    assert client.get("/api/payments/me").status_code == 401


def test_get_payments_group_401_without_token(client):
    assert client.get("/api/payments/group/some-group-id").status_code == 401


def test_get_payments_round_401_without_token(client):
    assert client.get("/api/payments/round/some-round-id").status_code == 401


def test_post_payments_401_without_token(client):
    assert client.post("/api/payments", json={}).status_code == 401


# ── Routing ───────────────────────────────────────────────────────────────

def test_get_payments_me_under_500_with_valid_token(client, auth_headers):
    assert client.get("/api/payments/me", headers=auth_headers).status_code < 500


def test_get_payments_group_under_500_with_valid_token(client, auth_headers):
    res = client.get(
        "/api/payments/group/00000000-0000-0000-0000-000000000001",
        headers=auth_headers,
    )
    assert res.status_code < 500


# ── Validation ────────────────────────────────────────────────────────────

def test_post_payments_400_on_empty_body(client, auth_headers):
    assert client.post("/api/payments", headers=auth_headers, json={}).status_code == 400


def test_post_payments_400_when_round_id_not_uuid(client, auth_headers):
    res = client.post(
        "/api/payments",
        headers=auth_headers,
        json={"round_id": "not-a-uuid", "amount": 500000},
    )
    assert res.status_code == 400


def test_post_payments_400_when_amount_below_minimum(client, auth_headers):
    res = client.post(
        "/api/payments",
        headers=auth_headers,
        json={"round_id": "00000000-0000-0000-0000-000000000001", "amount": 100},
    )
    assert res.status_code == 400


def test_patch_payments_confirm_401_without_token(client):
    assert client.patch("/api/payments/some-id/confirm").status_code == 401


def test_patch_payments_reject_401_without_token(client):
    res = client.patch("/api/payments/some-id/reject", json={"reason": "bad proof"})
    assert res.status_code == 401
