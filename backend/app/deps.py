"""FastAPI dependencies — the equivalent of the NestJS guards/decorators.

- :func:`get_auth` / :func:`current_user`  → ``AuthGuard`` + ``@CurrentUser()``
- :func:`require_roles`                    → ``RolesGuard`` + ``@Roles()``
- :func:`require_plan`                      → ``PlanGuard`` + ``@RequirePlan()``
"""
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Header, HTTPException

from .common.types import AuthUser, PlatformRole
from .db import maybe_single, supabase


@dataclass
class AuthContext:
    user: AuthUser
    access_token: str


def get_auth(authorization: Optional[str] = Header(default=None)) -> AuthContext:
    """Port of ``AuthGuard``. Verifies the Bearer token, loads the user's
    platform role, and returns the resolved auth context.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")

    token = authorization[7:]
    try:
        auth_user = supabase.verify_token(token)
    except Exception:
        raise HTTPException(401, "Invalid or expired token")

    if auth_user is None:
        raise HTTPException(401, "Invalid or expired token")

    profile = maybe_single(
        supabase.admin.from_("users").select("platform_role").eq("id", auth_user.id)
    )
    platform_role: PlatformRole = (
        (profile.get("platform_role") if profile else None) or "user"
    )

    user = AuthUser(
        id=auth_user.id,
        email=getattr(auth_user, "email", None),
        platform_role=platform_role,
    )
    return AuthContext(user=user, access_token=token)


def current_user(ctx: AuthContext = Depends(get_auth)) -> AuthUser:
    """Port of ``@CurrentUser()`` — returns the authenticated user."""
    return ctx.user


def access_token(ctx: AuthContext = Depends(get_auth)) -> str:
    """Returns the raw Bearer access token (for RLS-scoped clients)."""
    return ctx.access_token


def require_roles(*roles: PlatformRole):
    """Port of ``RolesGuard`` + ``@Roles(...)``. Use as a route dependency."""

    def _dep(user: AuthUser = Depends(current_user)) -> AuthUser:
        if user.platform_role not in roles:
            raise HTTPException(
                403, f"Requires platform role: {' or '.join(roles)}"
            )
        return user

    return _dep


# ─────────────────────────────────────────────────
# PlanGuard — enforce plan limits for resource creation
# ─────────────────────────────────────────────────
PlanResource = str  # 'groups' | 'bills'

_FREE_FALLBACK = {
    "slug": "free",
    "max_groups": 2,
    "max_members_per_group": 10,
    "max_bills_per_month": 5,
}


def _current_period_month() -> str:
    from .common.utils import utc_now

    now = utc_now()
    return f"{now.year}-{now.month:02d}-01"


def _resolve_active_plan(user_id: str) -> dict:
    data = maybe_single(
        supabase.admin.from_("user_subscriptions")
        .select(
            "plans (slug, max_groups, max_members_per_group, max_bills_per_month)"
        )
        .eq("user_id", user_id)
        .eq("status", "active")
    )

    joined = data.get("plans") if data else None
    if isinstance(joined, list):
        plan = joined[0] if joined else None
    else:
        plan = joined
    if plan:
        return plan

    free_plan = maybe_single(
        supabase.admin.from_("plans")
        .select("slug, max_groups, max_members_per_group, max_bills_per_month")
        .eq("slug", "free")
    )
    return free_plan or _FREE_FALLBACK


def require_plan(resource: PlanResource):
    """Port of ``PlanGuard`` + ``@RequirePlan(resource)``. ``resource`` is
    ``'groups'`` or ``'bills'``.
    """

    def _dep(user: AuthUser = Depends(current_user)) -> AuthUser:
        plan = _resolve_active_plan(user.id)

        # Plans with NULL limits are unlimited
        limit = plan.get("max_groups") if resource == "groups" else plan.get(
            "max_bills_per_month"
        )
        if limit is None:
            return user

        period_month = _current_period_month()
        usage = maybe_single(
            supabase.admin.from_("usage_tracking")
            .select("groups_created, bills_created")
            .eq("user_id", user.id)
            .eq("period_month", period_month)
        )

        if resource == "groups":
            used = (usage or {}).get("groups_created") or 0
        else:
            used = (usage or {}).get("bills_created") or 0

        if used >= limit:
            raise HTTPException(
                403,
                f"Plan limit reached for {resource} ({used}/{limit}). "
                "Upgrade to continue.",
            )
        return user

    return _dep
