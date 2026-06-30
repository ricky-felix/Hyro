"""Groups e2e tests — port of test/groups.e2e-spec.ts."""


# ── Auth guard ────────────────────────────────────────────────────────────────

def test_get_groups_401_no_token(client):
    assert client.get("/api/groups").status_code == 401


def test_get_groups_401_wrong_prefix(client):
    res = client.get("/api/groups", headers={"Authorization": "Basic badtoken"})
    assert res.status_code == 401


# ── Happy path (mocked Supabase returns null data — no crash) ─────────────────

def test_get_groups_under_500_with_valid_token(client, auth_headers):
    assert client.get("/api/groups", headers=auth_headers).status_code < 500


def test_get_group_by_id_under_500_with_valid_token(client, auth_headers):
    res = client.get(
        "/api/groups/00000000-0000-0000-0000-000000000001",
        headers=auth_headers,
    )
    assert res.status_code < 500


# ── Validation ────────────────────────────────────────────────────────────────

def test_post_groups_400_empty_body(client, auth_headers):
    assert client.post("/api/groups", headers=auth_headers, json={}).status_code == 400


def test_post_groups_400_name_too_short(client, auth_headers):
    res = client.post(
        "/api/groups",
        headers=auth_headers,
        json={
            "name": "AB",  # MinLength(3)
            "amount_per_round": 500000,
            "frequency": "monthly",
            "giliran_method": "random",
            "start_date": "2026-01-01",
            "total_rounds": 12,
        },
    )
    assert res.status_code == 400


def test_post_groups_400_invalid_frequency(client, auth_headers):
    res = client.post(
        "/api/groups",
        headers=auth_headers,
        json={
            "name": "Valid Name",
            "amount_per_round": 500000,
            "frequency": "daily",  # not in ['weekly','monthly']
            "giliran_method": "random",
            "start_date": "2026-01-01",
            "total_rounds": 12,
        },
    )
    assert res.status_code == 400


def test_post_groups_400_amount_below_minimum(client, auth_headers):
    res = client.post(
        "/api/groups",
        headers=auth_headers,
        json={
            "name": "Valid Group Name",
            "amount_per_round": 500,  # Min(1000)
            "frequency": "monthly",
            "giliran_method": "random",
            "start_date": "2026-01-01",
            "total_rounds": 5,
        },
    )
    assert res.status_code == 400


def test_post_groups_400_total_rounds_too_low(client, auth_headers):
    res = client.post(
        "/api/groups",
        headers=auth_headers,
        json={
            "name": "Valid Group Name",
            "amount_per_round": 500000,
            "frequency": "monthly",
            "giliran_method": "random",
            "start_date": "2026-01-01",
            "total_rounds": 1,  # Min(2)
        },
    )
    assert res.status_code == 400


def test_patch_group_401_without_token(client):
    res = client.patch("/api/groups/some-id", json={"name": "New Name"})
    assert res.status_code == 401


def test_delete_group_401_without_token(client):
    assert client.delete("/api/groups/some-id").status_code == 401
