"""DTOs for the payments controller — ports of ``src/payments/dto``."""
import uuid
from typing import Optional
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _validate_uuid(v: str) -> str:
    try:
        uuid.UUID(v)
    except ValueError:
        raise ValueError("must be a valid UUID")
    return v


def _validate_url(v):
    if v is None:
        return v
    parsed = urlparse(v)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError("proof_url must be a valid URL")
    return v


class CreatePaymentDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    round_id: str
    amount: int = Field(ge=1000)
    proof_url: Optional[str] = None
    notes: Optional[str] = None

    _v_round_id = field_validator("round_id")(_validate_uuid)
    _v_proof_url = field_validator("proof_url")(_validate_url)


class RejectPaymentDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    rejection_reason: str = Field(min_length=5)
