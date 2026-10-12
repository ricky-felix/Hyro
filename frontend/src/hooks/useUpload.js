import { useState } from 'react';
import { storageService } from '../services';
import { supabase } from '../lib/supabase';
import { isDemoMode } from '../lib/appMode';

/**
 * useUpload — reusable hook for uploading a File to private Supabase Storage,
 * matching the real backend contract (backend/src/storage/*).
 *
 * Flow:
 *   1. POST /storage/upload-url  { bucket, filename, content_type }
 *        → { bucket, path, signed_url, token }   (token-based signed upload)
 *   2. supabase.storage.from(bucket).uploadToSignedUrl(path, token, file)
 *   3. POST /storage/read-url  { bucket, path }  → { signed_url, expires_at }
 *   4. Return { path, read_url } so the caller can persist the durable `path`
 *      and use `read_url` for immediate preview.
 *
 * ⚠ Buckets are PRIVATE, so `read_url` is a SIGNED url that EXPIRES (default 1h).
 *   The durable reference is `path`. For long-lived display (e.g. avatars shown
 *   to other members) either persist `path` and resolve a fresh signed URL on
 *   render, or make the 'avatars' bucket public. See MVP-PUNCHLIST "storage".
 *
 * @returns {{ upload: Function, uploading: boolean, error: string|null }}
 */
export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Upload a File object to storage.
   * @param {File} file
   * @param {Object} opts
   * @param {string} opts.bucket - 'avatars' | 'receipts' | 'payment-proofs'
   * @param {string} [opts.fileName] - Override the file name (defaults to file.name)
   * @returns {Promise<{ path: string, read_url: string }|null>}
   */
  async function upload(file, { bucket, fileName } = {}) {
    if (!file) return null;

    setUploading(true);
    setError(null);

    // Demo mode: nothing leaves the browser — preview the local file instead.
    if (isDemoMode()) {
      setUploading(false);
      return {
        path: `demo/${fileName ?? file.name}`,
        read_url: URL.createObjectURL(file),
      };
    }

    try {
      const filename = fileName ?? file.name;
      const content_type = file.type || 'application/octet-stream';

      // 1. Ask the backend for a token-based signed upload URL.
      const { path, token } = await storageService.getUploadUrl({
        bucket,
        filename,
        content_type,
      });

      // 2. Upload the bytes via Supabase's token-based signed upload.
      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .uploadToSignedUrl(path, token, file, { contentType: content_type });

      if (uploadErr) {
        throw new Error(`Upload to storage failed: ${uploadErr.message}`);
      }

      // 3. Get a signed read URL for immediate preview (expires — see note above).
      const { signed_url } = await storageService.getReadUrl({ bucket, path });

      return { path, read_url: signed_url };
    } catch (err) {
      console.error('[useUpload] upload failed:', err.message);
      setError(err.message);
      return null;
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading, error };
}
