"""Plans & Subscriptions e2e tests — port of test/plans-subscriptions.e2e-spec.ts."""


# ── Plans — public endpoints (no auth required) ───────────────────────────────

def test_get_plans_public_under_500(client):
    # Plans list has no AuthGuard at the controller level.
    assert client.get("/api/plans").status_code < 500


def test_get_plan_by_slug_under_500_without_token(client):
    assert client.get("/api/plans/free").status_code < 500


# ── Plans — admin-only write endpoints (auth required) ───────────────────────

def test_post_plans_401_without_token(client):
    assert client.post("/api/plans", json={"name": "Test Plan", "slug": "test"}).status_code == 401


def test_patch_plan_401_without_token(client):
    assert client.patch("/api/plans/free", json={"name": "Updated"}).status_code == 401


def test_delete_plan_401_without_token(client):
    assert client.delete("/api/plans/free").status_code == 401


def test_post_plans_403_for_non_admin_user(client, auth_headers):
    # VALID_TOKEN → platform_role falls back to 'user' (mock returns data: null).
    # Super-admin-only route should return 403 (or 400 on validation before role check).
    res = client.post(
        "/api/plans",
        headers=auth_headers,
        json={"name": "Test Plan", "slug": "test", "price_monthly": 0},
    )
    assert res.status_code in (400, 403)


# ── Subscriptions — auth required ────────────────────────────────────────────

def test_get_subscriptions_me_401_without_token(client):
    assert client.get("/api/subscriptions/me").status_code == 401


def test_post_subscriptions_me_401_without_token(client):
    assert client.post("/api/subscriptions/me", json={}).status_code == 401


def test_delete_subscriptions_me_401_without_token(client):
    assert client.delete("/api/subscriptions/me").status_code == 401


def test_get_subscriptions_me_under_500_with_valid_token(client, auth_headers):
    assert client.get("/api/subscriptions/me", headers=auth_headers).status_code < 500


def test_get_subscriptions_group_under_500_with_valid_token(client, auth_headers):
    res = client.get(
        "/api/subscriptions/group/00000000-0000-0000-0000-000000000001",
        headers=auth_headers,
    )
    assert res.status_code < 500
