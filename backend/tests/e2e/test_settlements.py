"""Bill Settlements e2e tests — port of test/settlements.e2e-spec.ts."""


# ── Auth guard ────────────────────────────────────────────────────────────────

def test_post_settlements_401_without_token(client):
    assert client.post("/api/settlements", json={}).status_code == 401


def test_get_settlements_me_401_without_token(client):
    assert client.get("/api/settlements/me").status_code == 401


def test_get_settlements_bill_401_without_token(client):
    assert client.get("/api/settlements/bill/some-bill-id").status_code == 401


def test_patch_settlements_confirm_401_without_token(client):
    assert client.patch("/api/settlements/some-id/confirm").status_code == 401


def test_patch_settlements_reject_401_without_token(client):
    assert client.patch("/api/settlements/some-id/reject").status_code == 401


# ── Routing (happy path against null mock) ────────────────────────────────────

def test_get_settlements_me_under_500_with_valid_token(client, auth_headers):
    assert client.get("/api/settlements/me", headers=auth_headers).status_code < 500


def test_get_settlements_bill_under_500_with_valid_token(client, auth_headers):
    res = client.get(
        "/api/settlements/bill/00000000-0000-0000-0000-000000000001",
        headers=auth_headers,
    )
    assert res.status_code < 500


# ── Validation ────────────────────────────────────────────────────────────────

def test_post_settlements_400_empty_body(client, auth_headers):
    assert client.post("/api/settlements", headers=auth_headers, json={}).status_code == 400


def test_post_settlements_400_bill_id_not_uuid(client, auth_headers):
    res = client.post(
        "/api/settlements",
        headers=auth_headers,
        json={
            "bill_id": "not-a-uuid",
            "receiver_id": "00000000-0000-0000-0000-000000000001",
            "amount": 50000,
        },
    )
    assert res.status_code == 400


def test_post_settlements_400_amount_zero(client, auth_headers):
    res = client.post(
        "/api/settlements",
        headers=auth_headers,
        json={
            "bill_id": "00000000-0000-0000-0000-000000000001",
            "receiver_id": "00000000-0000-0000-0000-000000000002",
            "amount": 0,  # Min(1)
        },
    )
    assert res.status_code == 400


def test_post_settlements_400_receiver_id_missing(client, auth_headers):
    res = client.post(
        "/api/settlements",
        headers=auth_headers,
        json={
            "bill_id": "00000000-0000-0000-0000-000000000001",
            "amount": 50000,
            # receiver_id missing
        },
    )
    assert res.status_code == 400
