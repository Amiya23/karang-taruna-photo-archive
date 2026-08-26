"use client";

import { useEffect, useState } from "react";
import { resolveImageUrl, stablePhotoImageUrl, r2PublicUrl } from "@/lib/photo-url";
import { isB2Path } from "@/lib/b2/path";
import { isR2Path } from "@/lib/r2/path";

/**
 * Client-safe resolver for photo URLs.
 *
 * - Legacy/unprefixed storage_path: resolved synchronously via resolveImageUrl
 *   (Supabase public URL) — no network call, no credentials.
 * - "b2:" storage_path WITH a known photo id: returns the STABLE same-origin URL
 *   /api/photos/<id>/image (B2 fallback kept for compatibility). Without an id,
 *   fetches a presigned URL from /api/photo-url as before.
 * - "r2:" storage_path: returns the STABLE Cloudflare custom-domain public URL
 *   directly (r2PublicUrl). The object key is already in the storage_path, so no
 *   id, network call, or presigned URL is needed. No R2 credentials reach the
 *   browser.
 *
 * IMPORTANT: this module imports only pure helpers — never the B2/R2 adapter or
 * aws-sdk — so it is safe in the client bundle.
 */
export type PhotoUrlInput = string | { id?: string; storagePath: string };

function normalize(input: PhotoUrlInput): { id?: string; storagePath: string } {
  if (typeof input === "string") return { storagePath: input };
  return { id: input.id, storagePath: input.storagePath };
}

export function usePhotoUrl(input: PhotoUrlInput): string {
  const { id, storagePath } = normalize(input);
  const isR2 = !!storagePath && isR2Path(storagePath);
  const isB2 = !!storagePath && isB2Path(storagePath);
  const isProvider = isR2 || isB2;

  const initial =
    !storagePath || !isProvider
      ? storagePath
        ? resolveImageUrl(storagePath)
        : ""
      : isR2
        ? r2PublicUrl(storagePath)
        : id
          ? stablePhotoImageUrl(id)
          : "";

  const [url, setUrl] = useState<string>(initial);

  useEffect(() => {
    const isR2 = !!storagePath && isR2Path(storagePath);
    const isB2 = !!storagePath && isB2Path(storagePath);
    const isProvider = isR2 || isB2;
    if (!storagePath || !isProvider) {
      setUrl(storagePath ? resolveImageUrl(storagePath) : "");
      return;
    }
    if (isR2) {
      // R2: stable custom-domain public URL — no presigned URL, no fetch.
      setUrl(r2PublicUrl(storagePath));
      return;
    }
    if (id) {
      // B2: stable, cacheable same-origin URL — no per-mount fetch needed.
      setUrl(stablePhotoImageUrl(id));
      return;
    }
    // B2 defensive fallback: fetch a presigned URL (no id available).
    let cancelled = false;
    fetch(`/api/photo-url?path=${encodeURIComponent(storagePath)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.url === "string") setUrl(data.url);
      })
      .catch(() => {
        if (!cancelled) setUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [id, storagePath]);

  return url;
}
