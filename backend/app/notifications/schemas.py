"""DTOs for the notifications controller — port of ``src/notifications/dto``."""
import uuid
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

NotificationType = Literal[
    "payment_due",
    "payment_confirmed",
    "payment_rejected",
    "giliran_announced",
    "member_joined",
    "round_completed",
    "bill_created",
    "bill_settled",
    "bill_reminder",
    "settlement_confirmed",
    "settlement_rejected",
]


class CreateNotificationDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    user_id: str
    type: NotificationType
    title: str
    body: str
    metadata: Optional[Dict[str, Any]] = None

    @field_validator("user_id")
    @classmethod
    def validate_uuid(cls, v: str) -> str:
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError("user_id must be a valid UUID")
        return v
