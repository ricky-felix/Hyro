"""DTOs for the bill-participants controller — port of ``src/bill-participants/dto``."""
import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AddParticipantDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    user_id: str

    shares: Optional[int] = Field(default=None, ge=1)
    percentage: Optional[float] = Field(default=None, ge=0.01, le=100)
    exact_amount: Optional[int] = Field(default=None, ge=1)

    @field_validator("user_id")
    @classmethod
    def _is_uuid(cls, v: str) -> str:
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError("user_id must be a valid UUID")
        return v
