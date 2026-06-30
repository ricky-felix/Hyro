"""DTOs for the payment_transactions controller."""
from typing import Optional

from pydantic import BaseModel, ConfigDict

from ..common.types import Gateway, TransactionStatus, TransactionType


class ListAllQueryParams(BaseModel):
    """Query parameters for the super-admin listAll endpoint."""
    model_config = ConfigDict(extra="ignore")

    status: Optional[TransactionStatus] = None
    gateway: Optional[Gateway] = None
    type: Optional[TransactionType] = None
    limit: Optional[int] = None
    offset: Optional[int] = None
