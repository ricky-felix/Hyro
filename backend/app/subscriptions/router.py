"""Subscriptions controller — port of ``src/subscriptions/subscriptions.controller.ts``."""
from fastapi import APIRouter, Depends

from ..common.types import AuthUser
from ..deps import current_user, get_auth, require_roles
from .schemas import CancelSubscriptionDto, CreateGroupSubscriptionDto, CreateUserSubscriptionDto
from .service import SubscriptionsService

router = APIRouter(
    prefix="/subscriptions",
    tags=["subscriptions"],
    dependencies=[Depends(get_auth)],
)
service = SubscriptionsService()

# ── User subscriptions ──────────────────────────────────────────────

# Register literal routes (/me/...) BEFORE param routes (/:groupId/...)


@router.get("/me")
def get_my_subscription(user: AuthUser = Depends(current_user)):
    """Returns the current user's active subscription joined to the plan.
    Returns null (HTTP 200 with null body) if the user is on the free tier.
    """
    return service.get_active_for_user(user.id)


@router.post("/me", status_code=201)
def create_my_subscription(
    dto: CreateUserSubscriptionDto,
    user: AuthUser = Depends(current_user),
):
    """Creates a new user subscription.
    Throws 409 Conflict if the user already has an active subscription.
    """
    return service.create_user_subscription(dto, user.id)


@router.delete("/me")
def cancel_my_subscription(
    dto: CancelSubscriptionDto,
    user: AuthUser = Depends(current_user),
):
    """Cancels the current user's active subscription.
    The subscription remains accessible until current_period_end (not hard-deleted).
    """
    return service.cancel(user.id, dto)


# ── Admin triggers ──────────────────────────────────────────────────


@router.post(
    "/expire-due",
    status_code=201,
    dependencies=[Depends(require_roles("super_admin"))],
)
def expire_due():
    """Super-admin manual trigger to expire subscriptions past their period-end."""
    from ..common.utils import utc_now
    return service.expire_due(utc_now())


# ── Group subscriptions ─────────────────────────────────────────────


@router.get("/group/{group_id}")
def get_group_subscription(group_id: str):
    """Returns the active subscription for a specific group joined to the plan.
    Returns null if the group is on the free tier.
    """
    return service.get_active_for_group(group_id)


@router.post("/group/{group_id}", status_code=201)
def create_group_subscription(
    group_id: str,
    dto: CreateGroupSubscriptionDto,
    user: AuthUser = Depends(current_user),
):
    """Creates a new group subscription. Only the group admin may call this.
    Throws 409 Conflict if the group already has an active subscription.
    """
    # Ensure group_id in URL overrides any value in the body
    merged = CreateGroupSubscriptionDto(**{**dto.model_dump(), "group_id": group_id})
    return service.create_group_subscription(merged, user.id)


@router.delete("/group/{group_id}")
def cancel_group_subscription(
    group_id: str,
    dto: CancelSubscriptionDto,
    user: AuthUser = Depends(current_user),
):
    """Cancels the group subscription. Only the group admin may call this."""
    return service.cancel_group(group_id, user.id, dto)
