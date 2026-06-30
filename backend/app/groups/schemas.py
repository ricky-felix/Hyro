"""DTOs for the groups controller — ports of ``src/groups/dto``."""
from datetime import datetime
from typing import Literal, Optional
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _validate_url(v):
    if v is None:
        return v
    parsed = urlparse(v)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError("photo_url must be a valid URL")
    return v


def _validate_date_string(v):
    if v is None:
        return v
    try:
        datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        raise ValueError("start_date must be a valid ISO 8601 date string")
    return v


class CreateGroupDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(min_length=3, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    photo_url: Optional[str] = None
    amount_per_round: int = Field(ge=1000)
    frequency: Literal["weekly", "monthly"]
    giliran_method: Literal["random", "manual"]
    start_date: str
    total_rounds: int = Field(ge=2)

    _v_url = field_validator("photo_url")(_validate_url)
    _v_date = field_validator("start_date")(_validate_date_string)


class UpdateGroupDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = Field(default=None, min_length=3, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    photo_url: Optional[str] = None
    amount_per_round: Optional[int] = Field(default=None, ge=1000)
    frequency: Optional[Literal["weekly", "monthly"]] = None
    giliran_method: Optional[Literal["random", "manual"]] = None
    start_date: Optional[str] = None
    total_rounds: Optional[int] = Field(default=None, ge=2)

    _v_url = field_validator("photo_url")(_validate_url)
    _v_date = field_validator("start_date")(_validate_date_string)
