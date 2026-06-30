"""DTOs for the group-members controller — ports of ``src/group-members/dto``."""
import uuid
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _validate_uuid(v: str) -> str:
    try:
        uuid.UUID(v)
    except ValueError:
        raise ValueError("must be a valid UUID")
    return v


class AddMemberDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    user_id: str
    group_role: Optional[Literal["member", "admin"]] = None

    _v_user_id = field_validator("user_id")(_validate_uuid)


class GiliranAssignment(BaseModel):
    user_id: str
    giliran_order: int = Field(ge=1)

    _v_user_id = field_validator("user_id")(_validate_uuid)


class AssignGiliranDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    assignments: List[GiliranAssignment] = Field(min_length=1)
