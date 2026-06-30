"""Plans service — port of ``src/plans/plans.service.ts``."""
from fastapi import HTTPException

from ..db import fetch_all, maybe_single, supabase
from .schemas import UpsertPlanDto


class PlansService:
    def __init__(self) -> None:
        self.sb = supabase

    def list_active(self) -> list:
        """Returns all active plans ordered by monthly price ascending."""
        return fetch_all(
            self.sb.admin.from_("plans")
            .select("*")
            .eq("is_active", True)
            .order("price_monthly", desc=False)
        )

    def get_by_slug(self, slug: str) -> dict:
        """Returns a single plan by slug regardless of is_active status (admin use)."""
        data = maybe_single(
            self.sb.admin.from_("plans").select("*").eq("slug", slug)
        )
        if not data:
            raise HTTPException(404, f"Plan '{slug}' not found")
        return data

    def create(self, dto: UpsertPlanDto) -> dict:
        """Creates a new plan. slug and name are required.
        Only callable by super_admin (enforced at controller level).
        """
        if not dto.slug:
            raise HTTPException(400, "slug is required to create a plan")
        if not dto.name:
            raise HTTPException(400, "name is required to create a plan")

        res = (
            self.sb.admin.from_("plans")
            .insert(
                {
                    "slug": dto.slug,
                    "name": dto.name,
                    "description": dto.description if dto.description is not None else None,
                    "price_monthly": dto.price_monthly if dto.price_monthly is not None else 0,
                    "price_yearly": dto.price_yearly if dto.price_yearly is not None else 0,
                    "max_groups": dto.max_groups if dto.max_groups is not None else None,
                    "max_members_per_group": dto.max_members_per_group if dto.max_members_per_group is not None else None,
                    "max_bills_per_month": dto.max_bills_per_month if dto.max_bills_per_month is not None else None,
                    "recurring_bills": dto.recurring_bills if dto.recurring_bills is not None else False,
                    "analytics_access": dto.analytics_access if dto.analytics_access is not None else False,
                    "pdf_export": dto.pdf_export if dto.pdf_export is not None else False,
                    "debt_simplification": dto.debt_simplification if dto.debt_simplification is not None else False,
                    "custom_invite_links": dto.custom_invite_links if dto.custom_invite_links is not None else False,
                    "priority_support": dto.priority_support if dto.priority_support is not None else False,
                    "white_label": dto.white_label if dto.white_label is not None else False,
                    "is_active": dto.is_active if dto.is_active is not None else True,
                }
            )
            .execute()
        )
        return res.data[0]

    def update(self, slug: str, dto: UpsertPlanDto) -> dict:
        """Partial update of a plan by slug.
        Only callable by super_admin (enforced at controller level).
        """
        # Verify plan exists first
        self.get_by_slug(slug)

        patch = dto.model_dump(exclude_unset=True)
        # Remove slug from patch — slug is immutable on update
        patch.pop("slug", None)

        res = (
            self.sb.admin.from_("plans")
            .update(patch)
            .eq("slug", slug)
            .execute()
        )
        return res.data[0]

    def deactivate(self, slug: str) -> dict:
        """Soft-deactivates a plan by setting is_active=False.
        Hard deletion is never performed — plans remain for historical billing reference.
        """
        self.get_by_slug(slug)

        res = (
            self.sb.admin.from_("plans")
            .update({"is_active": False})
            .eq("slug", slug)
            .execute()
        )
        return res.data[0]
