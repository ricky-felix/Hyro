"""DTOs for the recurring-bills controller — ports of ``src/recurring-bills/dto``."""
import uuid
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..bills.schemas import BillParticipantInput

BillCategory = Literal[
    "food", "transport", "accommodation", "utilities",
    "entertainment", "shopping", "other",
]
SplitMethod = Literal["equal", "exact", "percentage", "shares"]
RecurringFrequency = Literal["weekly", "monthly", "yearly"]


def _validate_date_string(v):
    if v is None:
        return v
    try:
        datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        raise ValueError("must be a valid ISO 8601 date string")
    return v


class CreateRecurringBillDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    description: Optional[str] = None
    category: Optional[BillCategory] = None

    # Total bill amount in IDR; minimum 1
    total_amount: int = Field(ge=1)

    split_method: SplitMethod
    frequency: RecurringFrequency

    # ISO date strings (YYYY-MM-DD)
    start_date: str
    end_date: Optional[str] = None
    next_due_date: str

    is_active: Optional[bool] = None

    group_id: Optional[str] = None

    participants: List[BillParticipantInput] = Field(min_length=1)

    _v_start = field_validator("start_date")(_validate_date_string)
    _v_end = field_validator("end_date")(_validate_date_string)
    _v_next = field_validator("next_due_date")(_validate_date_string)

    @field_validator("group_id")
    @classmethod
    def _group_uuid(cls, v):
        if v is None:
            return v
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError("group_id must be a valid UUID")
        return v


class UpdateRecurringBillDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[BillCategory] = None
    total_amount: Optional[int] = Field(default=None, ge=1)
    split_method: Optional[SplitMethod] = None
    frequency: Optional[RecurringFrequency] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    next_due_date: Optional[str] = None
    is_active: Optional[bool] = None
    group_id: Optional[str] = None
    participants: Optional[List[BillParticipantInput]] = Field(default=None, min_length=1)

    _v_start = field_validator("start_date")(_validate_date_string)
    _v_end = field_validator("end_date")(_validate_date_string)
    _v_next = field_validator("next_due_date")(_validate_date_string)

    @field_validator("group_id")
    @classmethod
    def _group_uuid(cls, v):
        if v is None:
            return v
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError("group_id must be a valid UUID")
        return v
