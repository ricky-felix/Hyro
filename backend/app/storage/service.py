"""Storage service — port of ``src/storage/storage.service.ts``."""
import os
import re
import uuid
from datetime import timedelta

from fastapi import HTTPException

from ..common.utils import iso, utc_now
from ..db import supabase
from .schemas import ALLOWED_BUCKETS, AllowedBucket, CreateReadUrlDto, CreateUploadUrlDto

DEFAULT_EXPIRES_IN_SECONDS = 3600  # 1 hour


class StorageService:
    def __init__(self) -> None:
        self.sb = supabase

    def create_upload_url(
        self, dto: CreateUploadUrlDto, user_id: str
    ) -> dict:
        """Issues a Supabase Storage signed upload URL so the frontend can upload
        directly without forwarding the user's auth token to the backend.

        Path format: ``<userId>/<uuid>-<sanitisedFilename>``

        Returns: { bucket, path, signed_url, token }
        """
        self._validate_bucket(dto.bucket)

        sanitised = self._sanitise_filename(dto.filename)
        object_path = f"{user_id}/{str(uuid.uuid4())}-{sanitised}"

        res = self.sb.admin.storage.from_(dto.bucket).create_signed_upload_url(
            object_path
        )

        # supabase-py returns a dict; handle both snake_case and camelCase keys
        data = res if isinstance(res, dict) else (res.data if hasattr(res, "data") else None)

        if not data:
            raise HTTPException(500, "Failed to create signed upload URL: unknown error")

        # Accept both signedUrl (JS SDK style) and signed_url (snake_case)
        signed_url = data.get("signedUrl") or data.get("signed_url") or ""
        token = data.get("token") or ""

        if not signed_url:
            raise HTTPException(500, "Failed to create signed upload URL: missing signed_url in response")

        return {
            "bucket": dto.bucket,
            "path": object_path,
            "signed_url": signed_url,
            "token": token,
        }

    def create_read_url(
        self, dto: CreateReadUrlDto, user_id: str, is_super_admin: bool
    ) -> dict:
        """Issues a Supabase Storage signed read URL for an existing object.

        Ownership rule: the object path must start with ``<userId>/``.
        super_admin users may read any path in any bucket.

        Returns: { signed_url, expires_at }
        """
        self._validate_bucket(dto.bucket)
        self._assert_path_ownership(dto.path, user_id, is_super_admin)

        expires_in = dto.expires_in_seconds if dto.expires_in_seconds is not None else DEFAULT_EXPIRES_IN_SECONDS

        res = self.sb.admin.storage.from_(dto.bucket).create_signed_url(
            dto.path, expires_in
        )

        data = res if isinstance(res, dict) else (res.data if hasattr(res, "data") else None)

        signed_url = None
        if data:
            signed_url = data.get("signedUrl") or data.get("signed_url")

        if not signed_url:
            raise HTTPException(500, "Failed to create signed read URL: unknown error")

        expires_at = iso(utc_now() + timedelta(seconds=expires_in))

        return {
            "signed_url": signed_url,
            "expires_at": expires_at,
        }

    def delete(
        self,
        bucket: AllowedBucket,
        object_path: str,
        user_id: str,
        is_super_admin: bool,
    ) -> None:
        """Deletes a storage object.

        Ownership rule: the object path must start with ``<userId>/``.
        super_admin users may delete any path in any bucket.
        """
        self._validate_bucket(bucket)
        self._assert_path_ownership(object_path, user_id, is_super_admin)

        res = self.sb.admin.storage.from_(bucket).remove([object_path])

        # remove() raises on error; if it returns a result with an error field, surface it
        if isinstance(res, dict) and res.get("error"):
            raise HTTPException(
                500,
                f"Failed to delete storage object: {res['error'].get('message', 'unknown error')}",
            )

    # ── Private helpers ──────────────────────────────────────────────────────

    def _validate_bucket(self, bucket: str) -> None:
        """Guards against arbitrary bucket names outside the allowlist.
        The DTO validator already enforces this via Literal; this is defence-in-depth.
        """
        if bucket not in ALLOWED_BUCKETS:
            raise HTTPException(
                400,
                f"Invalid bucket. Allowed buckets: {', '.join(ALLOWED_BUCKETS)}",
            )

    def _assert_path_ownership(
        self, object_path: str, user_id: str, is_super_admin: bool
    ) -> None:
        """Ensures the storage path is owned by the requesting user.
        Paths are structured as ``<userId>/<rest>`` by create_upload_url().
        super_admin bypasses this check entirely.
        """
        if is_super_admin:
            return

        if not object_path.startswith(f"{user_id}/"):
            raise HTTPException(
                403,
                "You do not have permission to access this storage object",
            )

    def _sanitise_filename(self, filename: str) -> str:
        """Strips path separators from a filename to prevent directory traversal.

        Strategy (mirrors the TS implementation):
        1. Take only the basename (after the last / or \\).
        2. Replace any remaining path-separator characters with _.
        3. Collapse whitespace runs to a single underscore.
        4. Fall back to 'file' when the result is empty.
        """
        # Step 1: basename only
        sanitised = os.path.basename(filename)

        # Step 2: replace any lingering path separators (e.g. Windows paths on non-Windows)
        sanitised = re.sub(r"[/\\]", "_", sanitised)

        # Step 3: collapse whitespace
        sanitised = re.sub(r"\s+", "_", sanitised)

        # Step 4: fallback
        return sanitised if sanitised else "file"
