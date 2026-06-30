"""DTOs for the subscriptions controller — ports of ``src/subscriptions/dto``."""
import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..common.types import BillingCycle, Gateway, PlanSlug


class CreateUserSubscriptionDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    plan_slug: PlanSlug
    billing_cycle: BillingCycle
    gateway: Optional[Gateway] = None
    # External payment reference from the gateway (invoice ID, etc.)
    payment_ref: Optional[str] = None


class CreateGroupSubscriptionDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    group_id: str
    plan_slug: PlanSlug
    billing_cycle: BillingCycle
    gateway: Optional[Gateway] = None
    # External payment reference from the gateway (invoice ID, etc.)
    payment_ref: Optional[str] = None

    @field_validator("group_id")
    @classmethod
    def validate_uuid(cls, v: str) -> str:
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError("group_id must be a valid UUID")
        return v


class CancelSubscriptionDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    reason: Optional[str] = Field(default=None, max_length=512)
