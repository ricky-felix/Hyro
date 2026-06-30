"""Port of the status-mapping logic in the Xendit/Midtrans webhook controllers."""
from app.billing.midtrans_webhook import _map_midtrans_status
from app.billing.xendit_webhook import _map_xendit_status


# ── Xendit ───────────────────────────────────────────────────────
def test_xendit_paid_and_settled_map_to_paid():
    assert _map_xendit_status("PAID") == "paid"
    assert _map_xendit_status("settled") == "paid"


def test_xendit_other_known_statuses():
    assert _map_xendit_status("EXPIRED") == "expired"
    assert _map_xendit_status("FAILED") == "failed"
    assert _map_xendit_status("PENDING") == "pending"


def test_xendit_unknown_status_is_none():
    assert _map_xendit_status("weird") is None


# ── Midtrans ─────────────────────────────────────────────────────
def test_midtrans_settlement_and_capture_map_to_paid():
    assert _map_midtrans_status("settlement") == "paid"
    assert _map_midtrans_status("capture") == "paid"


def test_midtrans_failure_statuses():
    assert _map_midtrans_status("expire") == "expired"
    assert _map_midtrans_status("deny") == "failed"
    assert _map_midtrans_status("cancel") == "failed"
    assert _map_midtrans_status("failure") == "failed"


def test_midtrans_pending_and_default():
    assert _map_midtrans_status("pending") == "pending"
    assert _map_midtrans_status("anything-else") == "pending"
