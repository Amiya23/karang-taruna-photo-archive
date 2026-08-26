/**
 * Server-only storage_path -> image URL resolver.
 *
 * This module imports the B2 adapter (aws-sdk), so it MUST only be imported from
 * server code (server components, route handlers, server actions). Never import it
 * from a "use client" component — B2 credentials must never reach the browser.
 *
 * - Legacy/unprefixed storage_path -> Supabase public object URL.
 * - "b2:"-prefixed storage_path     -> B2 presigned GET URL (short-lived).
 *
 * For STABLE, cacheable rendering URLs (gallery/covers), prefer
 * `resolveImageView` / `resolveCoverUrl` below, which return the same-origin
 * /api/photos/[id]/image endpoint (no volatile presigned URL in the browser).
 */
import { photoPublicUrl, stablePhotoImageUrl, r2PublicUrl } from "@/lib/photo-url";
import { isB2Path, stripB2Prefix } from "@/lib/b2/path";
import { isR2Path } from "@/lib/r2/path";
import { createPresignedGetUrl } from "@/lib/b2/storage";
import { createPublicClient } from "@/lib/supabase/public";

export async function resolvedImageUrl(storagePath: string): Promise<string> {
  if (isB2Path(storagePath)) {
    return createPresignedGetUrl(stripB2Prefix(storagePath));
  }
  if (isR2Path(storagePath)) {
    // R2: stable Cloudflare custom-domain public URL (no credentials, no presign).
    return r2PublicUrl(storagePath);
  }
  return photoPublicUrl(storagePath);
}

/**
 * Stable, cacheable image URL for a photo that we already have the DB id for
 * (gallery thumbnails, hero highlights). Legacy -> Supabase public URL;
 * R2 -> stable Cloudflare custom-domain public URL (key is in storage_path, so no
 * id lookup needed); B2 -> same-origin /api/photos/[id]/image (preserved fallback).
 */
export function resolveImageView(
  id: string | undefined | null,
  storagePath: string | null | undefined
): string | undefined {
  if (!storagePath) return undefined;
  if (isR2Path(storagePath)) {
    return r2PublicUrl(storagePath);
  }
  if (isB2Path(storagePath)) {
    // B2 cover/photo: route by id so the URL is stable and cacheable.
    return id ? stablePhotoImageUrl(id) : undefined;
  }
  return photoPublicUrl(storagePath);
}

/**
 * Resolve a cover_image storage_path to a cacheable URL.
 *
 * Legacy/unprefixed -> Supabase public URL.
 * R2 -> stable Cloudflare custom-domain public URL (the object key is already
 *   in the storage_path, so no DB lookup is required).
 * B2 -> look up the linked photo row (public select, RLS-enforced) to obtain its
 *   id, then return the stable same-origin URL. If the B2 lookup fails we fall
 *   back to the volatile presigned URL so rendering never hard-breaks.
 */
export async function resolveCoverUrl(
  storagePath: string | null | undefined
): Promise<string | undefined> {
  if (!storagePath) return undefined;
  if (isR2Path(storagePath)) {
    return r2PublicUrl(storagePath);
  }
  if (!isB2Path(storagePath)) {
    return photoPublicUrl(storagePath);
  }
  try {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("photos")
      .select("id")
      .eq("storage_path", storagePath)
      .maybeSingle();
    if (data?.id) return stablePhotoImageUrl(data.id);
  } catch {
    // fall through to presigned fallback
  }
  return resolvedImageUrl(storagePath);
}
