"""Pydantic request bodies for the users + payment-methods controllers.

Ports of the class-validator DTOs under ``src/users/dto``.
"""
import re
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..common.types import PaymentMethodType


class UpdateUserDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=32)
    avatar_url: Optional[str] = None
    language: Optional[Literal["id", "en"]] = None
    gender: Optional[Literal["male", "female"]] = None


class SetPinDto(BaseModel):
    pin: str

    @field_validator("pin")
    @classmethod
    def _six_digits(cls, v: str) -> str:
        if not re.fullmatch(r"\d{6}", v):
            raise ValueError("pin must be exactly 6 digits")
        return v


class VerifyPinDto(BaseModel):
    pin: str

    @field_validator("pin")
    @classmethod
    def _six_digits(cls, v: str) -> str:
        if not re.fullmatch(r"\d{6}", v):
            raise ValueError("pin must be exactly 6 digits")
        return v


class UpdateSecurityDto(BaseModel):
    app_lock_enabled: bool


class UpsertBankAccountDto(BaseModel):
    bank: str = Field(min_length=1, max_length=80)
    account_number: str = Field(min_length=1, max_length=32)
    holder_name: str = Field(min_length=1, max_length=120)


# ─────────────────────────────────────────────────
# Payment methods
# ─────────────────────────────────────────────────
_EWALLET_TYPES = {"gopay", "ovo", "dana", "shopeepay", "linkaja"}


class CreatePaymentMethodDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: PaymentMethodType
    label: str = Field(min_length=1, max_length=50)
    account_number: Optional[str] = None
    holder_name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    phone: Optional[str] = None
    qris_image_path: Optional[str] = Field(default=None, max_length=500)
    is_primary: Optional[bool] = None

    @field_validator("account_number")
    @classmethod
    def _account_number(cls, v):
        if v is not None and not re.fullmatch(r"\d{6,20}", v):
            raise ValueError(
                "account_number must be 6–20 digits (numeric only, no spaces)"
            )
        return v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        if v is not None and not re.fullmatch(r"\d{8,15}", v):
            raise ValueError(
                "phone must be 8–15 digits (numeric only). Strip leading + before sending."
            )
        return v

    @field_validator("phone")
    @classmethod
    def _phone_required_for_ewallet(cls, v, info):
        # ValidateIf((o) => EWALLET_TYPES.includes(o.type)) — phone required for e-wallets
        method_type = info.data.get("type")
        if method_type in _EWALLET_TYPES and not v:
            raise ValueError("phone is required for e-wallet payment methods")
        return v


class UpdatePaymentMethodDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    label: Optional[str] = Field(default=None, min_length=1, max_length=50)
    account_number: Optional[str] = None
    holder_name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    phone: Optional[str] = None
    qris_image_path: Optional[str] = Field(default=None, max_length=500)
    is_primary: Optional[bool] = None

    @field_validator("account_number")
    @classmethod
    def _account_number(cls, v):
        if v is not None and not re.fullmatch(r"\d{6,20}", v):
            raise ValueError(
                "account_number must be 6–20 digits (numeric only, no spaces)"
            )
        return v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        if v is not None and not re.fullmatch(r"\d{8,15}", v):
            raise ValueError(
                "phone must be 8–15 digits (numeric only). Strip leading + before sending."
            )
        return v
