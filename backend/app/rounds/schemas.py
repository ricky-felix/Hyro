"""DTOs for the rounds controller — ports of ``src/rounds/dto``."""
import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


def _validate_uuid(v: str) -> str:
    try:
        uuid.UUID(v)
    except ValueError:
        raise ValueError("must be a valid UUID")
    return v


class SetRecipientDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    recipient_id: str

    _v_recipient_id = field_validator("recipient_id")(_validate_uuid)
