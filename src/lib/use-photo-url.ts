"use client";

import { useEffect, useState } from "react";
import { resolveImageUrl } from "@/lib/photo-url";
import { isB2Path } from "@/lib/b2/path";

/**
 * Client-safe resolver for photo URLs.
 *
 * - Legacy/unprefixed storage_path: resolved synchronously via resolveImageUrl
 *   (Supabase public URL) — no network call, no credentials.
 * - "b2:" storage_path: the B2 presigned URL is generated server-side by
 *   /api/photo-url (B2 credentials never reach the browser). This hook fetches
 *   that endpoint and returns the resulting URL.
 *
 * IMPORTANT: this module imports only pure helpers (isB2Path) — never the B2
 * adapter or aws-sdk — so it is safe in the client bundle.
 */
export function usePhotoUrl(storagePath: string | null | undefined): string {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    if (!storagePath) {
      setUrl("");
      return;
    }
    if (isB2Path(storagePath)) {
      let cancelled = false;
      fetch(`/api/photo-url?path=${encodeURIComponent(storagePath)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled && data && typeof data.url === "string") {
            setUrl(data.url);
          }
        })
        .catch(() => {
          if (!cancelled) setUrl("");
        });
      return () => {
        cancelled = true;
      };
    }
    setUrl(resolveImageUrl(storagePath));
  }, [storagePath]);

  return url;
}
