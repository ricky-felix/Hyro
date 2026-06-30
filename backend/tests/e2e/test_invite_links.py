"""Invite Links e2e tests — port of test/invite-links.e2e-spec.ts."""


# ── Auth guard ────────────────────────────────────────────────────────────

def test_post_invites_401_without_token(client):
    assert client.post("/api/invites", json={}).status_code == 401


def test_get_invites_group_401_without_token(client):
    assert client.get("/api/invites/group/some-group-id").status_code == 401


def test_post_invites_redeem_401_without_token(client):
    assert client.post("/api/invites/redeem/SOME-CODE").status_code == 401


def test_patch_invites_revoke_401_without_token(client):
    assert client.patch("/api/invites/some-id/revoke").status_code == 401


# ── Routing ───────────────────────────────────────────────────────────────

def test_get_invites_group_under_500_with_valid_token(client, auth_headers):
    res = client.get(
        "/api/invites/group/00000000-0000-0000-0000-000000000001",
        headers=auth_headers,
    )
    assert res.status_code < 500


# ── Validation ────────────────────────────────────────────────────────────

def test_post_invites_400_on_empty_body(client, auth_headers):
    assert client.post("/api/invites", headers=auth_headers, json={}).status_code == 400


def test_post_invites_400_when_group_id_not_uuid(client, auth_headers):
    res = client.post(
        "/api/invites",
        headers=auth_headers,
        json={"group_id": "not-a-uuid"},
    )
    assert res.status_code == 400


def test_post_invites_400_when_max_uses_is_zero(client, auth_headers):
    res = client.post(
        "/api/invites",
        headers=auth_headers,
        json={"group_id": "00000000-0000-0000-0000-000000000001", "max_uses": 0},
    )
    assert res.status_code == 400


def test_post_invites_under_500_with_valid_payload(client, auth_headers):
    res = client.post(
        "/api/invites",
        headers=auth_headers,
        json={
            "group_id": "00000000-0000-0000-0000-000000000001",
            "max_uses": 5,
            "expires_at": "2027-01-01",
        },
    )
    assert res.status_code < 500


def test_post_invites_redeem_under_500_with_valid_token(client, auth_headers):
    res = client.post("/api/invites/redeem/ABC123", headers=auth_headers)
    assert res.status_code < 500
