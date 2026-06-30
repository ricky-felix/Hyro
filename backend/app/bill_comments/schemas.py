"""DTOs for the bill-comments controller — port of ``src/bill-comments/dto``."""
import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CreateCommentDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    bill_id: str
    body: str = Field(min_length=1)
    parent_id: Optional[str] = None

    @field_validator("bill_id")
    @classmethod
    def _bill_id_uuid(cls, v: str) -> str:
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError("bill_id must be a valid UUID")
        return v

    @field_validator("parent_id")
    @classmethod
    def _parent_id_uuid(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError("parent_id must be a valid UUID")
        return v


class UpdateCommentDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    body: str = Field(min_length=1)
