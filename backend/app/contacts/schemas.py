"""Pydantic request bodies for the contacts controller.

Ports of the class-validator DTOs under ``src/contacts/dto``.
"""
import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CreateContactDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(min_length=1, max_length=100)

    # At least one of phone or contact_id must be provided — checked in the service
    phone: Optional[str] = Field(default=None, max_length=30)
    contact_id: Optional[str] = None

    @field_validator("contact_id")
    @classmethod
    def _valid_uuid(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        try:
            uuid.UUID(v, version=4)
        except ValueError:
            raise ValueError("contact_id must be a valid UUID v4")
        return v


class UpdateContactDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=30)
    contact_id: Optional[str] = None

    @field_validator("contact_id")
    @classmethod
    def _valid_uuid(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        try:
            uuid.UUID(v, version=4)
        except ValueError:
            raise ValueError("contact_id must be a valid UUID v4")
        return v


class TouchContactDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    # Exactly one of phone or contact_id must be provided — checked in the router
    phone: Optional[str] = Field(default=None, max_length=30)
    contact_id: Optional[str] = None

    @field_validator("contact_id")
    @classmethod
    def _valid_uuid(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        try:
            uuid.UUID(v, version=4)
        except ValueError:
            raise ValueError("contact_id must be a valid UUID v4")
        return v
