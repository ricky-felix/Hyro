"""DTOs for the bills controller — ports of ``src/bills/dto``."""
from typing import List, Literal, Optional
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator

BillCategory = Literal[
    "food", "transport", "accommodation", "utilities",
    "entertainment", "shopping", "other",
]
SplitMethod = Literal["equal", "exact", "percentage", "shares"]


def _validate_url(v):
    if v is None:
        return v
    parsed = urlparse(v)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError("receipt_url must be a valid URL")
    return v


class BillParticipantInput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    user_id: str = Field(description="UUID")
    shares: Optional[int] = Field(default=None, ge=1)
    percentage: Optional[float] = Field(default=None, ge=0.01, le=100)
    exact_amount: Optional[int] = Field(default=None, ge=1)

    @field_validator("user_id")
    @classmethod
    def _is_uuid(cls, v: str) -> str:
        import uuid

        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError("user_id must be a valid UUID")
        return v


class CreateBillDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    description: Optional[str] = None
    category: Optional[BillCategory] = None
    total_amount: int = Field(ge=1)
    split_method: SplitMethod
    receipt_url: Optional[str] = None
    group_id: Optional[str] = None
    participants: List[BillParticipantInput] = Field(min_length=1)

    _v_url = field_validator("receipt_url")(_validate_url)

    @field_validator("group_id")
    @classmethod
    def _group_uuid(cls, v):
        if v is None:
            return v
        import uuid

        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError("group_id must be a valid UUID")
        return v


class UpdateBillDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[BillCategory] = None
    receipt_url: Optional[str] = None
    total_amount: Optional[int] = Field(default=None, ge=1)
    split_method: Optional[SplitMethod] = None
    participants: Optional[List[BillParticipantInput]] = Field(default=None, min_length=1)

    _v_url = field_validator("receipt_url")(_validate_url)
