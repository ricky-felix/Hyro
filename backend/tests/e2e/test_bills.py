"""Bills e2e tests — port of test/bills.e2e-spec.ts."""


# ── Auth guard ────────────────────────────────────────────────────────────

def test_get_bills_401_without_token(client):
    assert client.get("/api/bills").status_code == 401


def test_post_bills_401_without_token(client):
    res = client.post(
        "/api/bills",
        json={"title": "test", "total_amount": 10000, "split_method": "equal", "participants": []},
    )
    assert res.status_code == 401


# ── Routing ───────────────────────────────────────────────────────────────

def test_get_bills_under_500_with_valid_token(client, auth_headers):
    assert client.get("/api/bills", headers=auth_headers).status_code < 500


def test_get_bill_by_id_under_500_with_valid_token(client, auth_headers):
    res = client.get(
        "/api/bills/00000000-0000-0000-0000-000000000001",
        headers=auth_headers,
    )
    assert res.status_code < 500


# ── Validation ────────────────────────────────────────────────────────────

def test_post_bills_400_on_empty_body(client, auth_headers):
    assert client.post("/api/bills", headers=auth_headers, json={}).status_code == 400


def test_post_bills_400_when_participants_missing(client, auth_headers):
    res = client.post(
        "/api/bills",
        headers=auth_headers,
        json={"title": "Dinner", "total_amount": 100000, "split_method": "equal"},
    )
    assert res.status_code == 400


def test_post_bills_400_when_participants_empty(client, auth_headers):
    res = client.post(
        "/api/bills",
        headers=auth_headers,
        json={
            "title": "Dinner",
            "total_amount": 100000,
            "split_method": "equal",
            "participants": [],
        },
    )
    assert res.status_code == 400


def test_post_bills_400_when_split_method_invalid(client, auth_headers):
    res = client.post(
        "/api/bills",
        headers=auth_headers,
        json={
            "title": "Dinner",
            "total_amount": 100000,
            "split_method": "random",
            "participants": [{"user_id": "00000000-0000-0000-0000-000000000001"}],
        },
    )
    assert res.status_code == 400


def test_post_bills_400_when_total_amount_is_zero(client, auth_headers):
    res = client.post(
        "/api/bills",
        headers=auth_headers,
        json={
            "title": "Dinner",
            "total_amount": 0,
            "split_method": "equal",
            "participants": [{"user_id": "00000000-0000-0000-0000-000000000001"}],
        },
    )
    assert res.status_code == 400


def test_post_bills_400_when_total_amount_missing(client, auth_headers):
    res = client.post(
        "/api/bills",
        headers=auth_headers,
        json={
            "title": "Dinner",
            "split_method": "equal",
            "participants": [{"user_id": "00000000-0000-0000-0000-000000000001"}],
        },
    )
    assert res.status_code == 400


def test_patch_bills_settle_401_without_token(client):
    assert client.patch("/api/bills/some-id/settle").status_code == 401


def test_delete_bill_401_without_token(client):
    assert client.delete("/api/bills/some-id").status_code == 401
