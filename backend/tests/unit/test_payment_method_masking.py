"""Port of the peer-masking logic in payment-methods.service.ts."""
from app.users.payment_methods_service import (
    _generate_method_id,
    _is_legacy_v0,
    _mask_for_peer,
)


def _method(**over):
    base = {
        "id": "pm_1",
        "type": "gopay",
        "label": "My GoPay",
        "account_number": "1234567890",
        "holder_name": "Budi",
        "phone": "081234567890",
        "qris_image_path": None,
        "is_primary": True,
        "created_at": "2026-01-01T00:00:00.000Z",
        "updated_at": "2026-01-02T00:00:00.000Z",
    }
    base.update(over)
    return base


def test_mask_keeps_last_4_of_account_and_phone():
    masked = _mask_for_peer(_method())
    assert masked["account_number"] == "••••7890"
    assert masked["phone"] == "••••7890"
    # holder_name kept in full
    assert masked["holder_name"] == "Budi"


def test_mask_drops_updated_at():
    masked = _mask_for_peer(_method())
    assert "updated_at" not in masked


def test_mask_handles_null_fields():
    masked = _mask_for_peer(_method(account_number=None, phone=None))
    assert masked["account_number"] is None
    assert masked["phone"] is None


def test_generate_method_id_prefix():
    mid = _generate_method_id()
    assert mid.startswith("pm_")
    assert len(mid) > 3


def test_is_legacy_v0_detection():
    assert _is_legacy_v0(["gopay", "ovo"]) is True
    assert _is_legacy_v0([{"id": "pm_1"}]) is False
    assert _is_legacy_v0([]) is False
