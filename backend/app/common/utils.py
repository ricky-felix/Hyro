"""Small cross-cutting helpers."""
from datetime import datetime, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    """ISO-8601 timestamp in UTC with a trailing ``Z`` (matches JS toISOString)."""
    return utc_now().strftime("%Y-%m-%dT%H:%M:%S.") + f"{utc_now().microsecond // 1000:03d}Z"


def iso(dt: datetime) -> str:
    """Format a datetime as an ISO-8601 UTC string with a trailing ``Z``."""
    dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"
