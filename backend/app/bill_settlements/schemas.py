"""DTOs for the bill-settlements controller — port of ``src/bill-settlements/dto``."""
import uuid
from typing import Optional
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _validate_url(v):
    if v is None:
        return v
    parsed = urlparse(v)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError("proof_url must be a valid URL")
    return v


class CreateSettlementDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    bill_id: str
    receiver_id: str
    amount: int = Field(ge=1)
    proof_url: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("bill_id", "receiver_id")
    @classmethod
    def _is_uuid(cls, v: str) -> str:
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError(f"{v!r} must be a valid UUID")
        return v

    _v_url = field_validator("proof_url")(_validate_url)


class RejectSettlementDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    reason: str = Field(min_length=1)
