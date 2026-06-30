"""Pydantic request bodies for the storage controller.

Ports of the class-validator DTOs under ``src/storage/dto``.
"""
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

# Allowed Supabase Storage buckets — all must be PRIVATE in the Supabase Dashboard.
#   avatars        : user profile pictures
#   receipts       : bill receipt photos
#   payment-proofs : arisan iuran payment proof images
ALLOWED_BUCKETS = ("avatars", "receipts", "payment-proofs")
AllowedBucket = Literal["avatars", "receipts", "payment-proofs"]


class CreateUploadUrlDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    bucket: AllowedBucket
    filename: str = Field(min_length=1, max_length=255)
    content_type: Optional[str] = Field(default=None, max_length=100)


class CreateReadUrlDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    bucket: AllowedBucket
    path: str = Field(min_length=1, max_length=512)
    # Signed URL validity in seconds. Defaults to 3600, max 86400.
    expires_in_seconds: Optional[int] = Field(default=None, ge=60, le=86400)


class DeleteObjectDto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    bucket: AllowedBucket
    path: str = Field(min_length=1, max_length=512)
