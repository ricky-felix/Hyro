"""Plans controller — port of ``src/plans/plans.controller.ts``."""
from fastapi import APIRouter, Depends

from ..deps import get_auth, require_roles
from .schemas import UpsertPlanDto
from .service import PlansService

# Note: GET endpoints are public (no auth) — only write endpoints require super_admin.
# We do NOT add dependencies=[Depends(get_auth)] at the router level because
# GET routes are public. Instead, auth is added per-route on write operations.
router = APIRouter(prefix="/plans", tags=["plans"])
service = PlansService()


@router.get("")
def list_active():
    """Public — no auth required. Returns all active plans ordered by price ascending."""
    return service.list_active()


@router.get("/{slug}")
def get_by_slug(slug: str):
    """Public — no auth required. Returns a single plan including inactive ones."""
    return service.get_by_slug(slug)


@router.post(
    "",
    status_code=201,
    dependencies=[Depends(get_auth), Depends(require_roles("super_admin"))],
)
def create(dto: UpsertPlanDto):
    """Super-admin only: create a new plan."""
    return service.create(dto)


@router.patch(
    "/{slug}",
    dependencies=[Depends(get_auth), Depends(require_roles("super_admin"))],
)
def update(slug: str, dto: UpsertPlanDto):
    """Super-admin only: partially update an existing plan by slug."""
    return service.update(slug, dto)


@router.delete(
    "/{slug}",
    dependencies=[Depends(get_auth), Depends(require_roles("super_admin"))],
)
def deactivate(slug: str):
    """Super-admin only: soft-deactivate a plan (sets is_active=False).
    Plans are NEVER hard-deleted — they remain for historical billing reference.
    """
    return service.deactivate(slug)
