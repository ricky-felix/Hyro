"""DTOs for the invite-links controller — ports of ``src/invite-links/dto``."""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _validate_uuid(v: str) -> str:
    try:
        uuid.UUID(v)
    except ValueError:
        raise ValueError("must be a valid UUID")
    return v


def _validate_date_string(v):
    if v is None:
        return v
    try:
        datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        raise ValueError("expires_at must be a valid ISO 8601 date string")
    return v


class CreateInviteDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    group_id: str
    max_uses: Optional[int] = Field(default=None, ge=1)
    expires_at: Optional[str] = None

    _v_group_id = field_validator("group_id")(_validate_uuid)
    _v_expires_at = field_validator("expires_at")(_validate_date_string)
