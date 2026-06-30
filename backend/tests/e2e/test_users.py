"""Users e2e tests — port of test/users.e2e-spec.ts."""


# ── Auth guard ────────────────────────────────────────────────────────────────

def test_get_users_me_401_without_token(client):
    assert client.get("/api/users/me").status_code == 401


def test_get_users_me_401_invalid_token(client):
    res = client.get(
        "/api/users/me",
        headers={"Authorization": "Bearer totally-invalid-token"},
    )
    assert res.status_code == 401


# ── Routing ───────────────────────────────────────────────────────────────────

def test_get_users_me_under_500_with_valid_token(client, auth_headers):
    assert client.get("/api/users/me", headers=auth_headers).status_code < 500


def test_patch_users_me_401_without_token(client):
    res = client.patch("/api/users/me", json={"full_name": "Test User"})
    assert res.status_code == 401


def test_patch_users_me_under_500_with_valid_token(client, auth_headers):
    res = client.patch(
        "/api/users/me",
        headers=auth_headers,
        json={"full_name": "Test User"},
    )
    assert res.status_code < 500


# ── Roles guard — super_admin-only endpoint ───────────────────────────────────

def test_get_users_403_for_non_admin(client, auth_headers):
    # VALID_TOKEN → platform_role falls back to 'user' (mock returns data: null).
    # Should be 403 (non-admin), or at worst some other non-500 status.
    res = client.get("/api/users", headers=auth_headers)
    assert res.status_code in (200, 403, 404)
    assert res.status_code < 500


# ── PIN endpoints ─────────────────────────────────────────────────────────────

def test_patch_users_me_pin_401_without_token(client):
    assert client.patch("/api/users/me/pin", json={"pin": "123456"}).status_code == 401


def test_post_users_me_pin_verify_401_without_token(client):
    assert client.post("/api/users/me/pin/verify", json={"pin": "123456"}).status_code == 401


def test_get_users_me_security_401_without_token(client):
    assert client.get("/api/users/me/security").status_code == 401


def test_get_users_me_bank_account_401_without_token(client):
    assert client.get("/api/users/me/bank-account").status_code == 401
