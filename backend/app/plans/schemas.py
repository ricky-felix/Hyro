"""DTOs for the plans controller — ports of ``src/plans/dto/upsert-plan.dto.ts``."""
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class UpsertPlanDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    # Unique identifier slug — required on create, immutable on update.
    slug: Optional[str] = Field(default=None, max_length=64)

    name: Optional[str] = Field(default=None, max_length=128)

    description: Optional[str] = Field(default=None, max_length=512)

    # Monthly price in IDR (integer, no decimals). 0 = free.
    price_monthly: Optional[int] = Field(default=None, ge=0)

    # Yearly price in IDR (integer, no decimals). 0 = free.
    price_yearly: Optional[int] = Field(default=None, ge=0)

    # NULL = unlimited
    max_groups: Optional[int] = Field(default=None, ge=1)

    # NULL = unlimited
    max_members_per_group: Optional[int] = Field(default=None, ge=1)

    # NULL = unlimited
    max_bills_per_month: Optional[int] = Field(default=None, ge=1)

    recurring_bills: Optional[bool] = None
    analytics_access: Optional[bool] = None
    pdf_export: Optional[bool] = None
    debt_simplification: Optional[bool] = None
    custom_invite_links: Optional[bool] = None
    priority_support: Optional[bool] = None
    white_label: Optional[bool] = None
    is_active: Optional[bool] = None
