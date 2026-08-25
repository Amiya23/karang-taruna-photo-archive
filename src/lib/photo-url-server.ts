/**
 * Server-only storage_path -> image URL resolver.
 *
 * This module imports the B2 adapter (aws-sdk), so it MUST only be imported from
 * server code (server components, route handlers, server actions). Never import it
 * from a "use client" component — B2 credentials must never reach the browser.
 *
 * - Legacy/unprefixed storage_path -> Supabase public object URL.
 * - "b2:"-prefixed storage_path     -> B2 presigned GET URL (short-lived).
 */
import { photoPublicUrl } from "@/lib/photo-url";
import { isB2Path, stripB2Prefix } from "@/lib/b2/path";
import { createPresignedGetUrl } from "@/lib/b2/storage";

export async function resolvedImageUrl(storagePath: string): Promise<string> {
  if (isB2Path(storagePath)) {
    return createPresignedGetUrl(stripB2Prefix(storagePath));
  }
  return photoPublicUrl(storagePath);
}
