"""Bill Participants e2e tests — port of test/bill-participants.e2e-spec.ts."""


# ── Auth guard ────────────────────────────────────────────────────────────

def test_post_bill_participants_401_without_token(client):
    res = client.post("/api/bills/some-bill-id/participants", json={})
    assert res.status_code == 401


def test_delete_bill_participant_401_without_token(client):
    res = client.delete("/api/bills/some-bill-id/participants/some-participant-id")
    assert res.status_code == 401


# ── Routing ───────────────────────────────────────────────────────────────

def test_post_bill_participants_under_500_with_valid_token(client, auth_headers):
    res = client.post(
        "/api/bills/00000000-0000-0000-0000-000000000001/participants",
        headers=auth_headers,
        json={"user_id": "00000000-0000-0000-0000-000000000002"},
    )
    assert res.status_code < 500


def test_delete_bill_participant_under_500_with_valid_token(client, auth_headers):
    res = client.delete(
        "/api/bills/00000000-0000-0000-0000-000000000001/participants/00000000-0000-0000-0000-000000000002",
        headers=auth_headers,
    )
    assert res.status_code < 500
