"""Sync e2e tests — auth guard + routing smoke test for GET /sync/pull."""


def test_get_sync_pull_401_without_token(client):
    assert client.get("/api/sync/pull").status_code == 401


def test_get_sync_pull_under_500_with_valid_token(client, auth_headers):
    assert client.get("/api/sync/pull", headers=auth_headers).status_code < 500


def test_get_sync_pull_accepts_since_param(client, auth_headers):
    res = client.get(
        "/api/sync/pull",
        params={"since": "2026-01-01T00:00:00.000Z"},
        headers=auth_headers,
    )
    assert res.status_code < 500
