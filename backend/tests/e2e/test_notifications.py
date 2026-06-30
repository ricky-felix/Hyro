"""Notifications e2e tests — port of test/notifications.e2e-spec.ts."""


# ── Auth guard ────────────────────────────────────────────────────────────

def test_get_notifications_401_without_token(client):
    assert client.get("/api/notifications").status_code == 401


def test_get_notifications_unread_count_401_without_token(client):
    assert client.get("/api/notifications/unread-count").status_code == 401


def test_post_notifications_read_401_without_token(client):
    assert client.post("/api/notifications/some-id/read").status_code == 401


def test_post_notifications_read_all_401_without_token(client):
    assert client.post("/api/notifications/read-all").status_code == 401


# ── Routing ───────────────────────────────────────────────────────────────

def test_get_notifications_under_500_with_valid_token(client, auth_headers):
    assert client.get("/api/notifications", headers=auth_headers).status_code < 500


def test_get_notifications_unread_count_under_500_with_valid_token(client, auth_headers):
    assert client.get("/api/notifications/unread-count", headers=auth_headers).status_code < 500


def test_post_notifications_read_all_under_500_with_valid_token(client, auth_headers):
    assert client.post("/api/notifications/read-all", headers=auth_headers).status_code < 500


def test_post_notifications_read_by_id_under_500_with_valid_token(client, auth_headers):
    res = client.post(
        "/api/notifications/00000000-0000-0000-0000-000000000001/read",
        headers=auth_headers,
    )
    assert res.status_code < 500
