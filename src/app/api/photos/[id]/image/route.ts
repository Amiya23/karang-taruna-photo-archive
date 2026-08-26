import { type NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { isB2Path, stripB2Prefix } from "@/lib/b2/path";
import { isR2Path, stripR2Prefix } from "@/lib/r2/path";
import { getObjectBytes as getB2ObjectBytes } from "@/lib/b2/storage";
import { getObjectBytes as getR2ObjectBytes } from "@/lib/r2/storage";
import { contentTypeFromFilename } from "@/lib/photo-url";

// Per-request resolution (provider/cache depend on the row), never prerender.
export const dynamic = "force-dynamic";

/**
 * GET /api/photos/[id]/image
 *
 * Stable, same-origin, cacheable rendering endpoint for a photo row.
 *
 * - Input is ONLY the Supabase photo id (never a raw B2 key or path).
 * - Resolves the storage provider from the DB row's storage_path:
 *     - "b2:" prefix -> fetch object bytes from Backblaze B2 (server-side creds).
 *     - otherwise    -> fetch from Supabase Storage (legacy photos).
 * - Returns image bytes with a long-lived, immutable Cache-Control so the
 *   browser / Next.js Image optimizer / CDN can serve repeat views without
 *   re-reading B2. No presigned URL or credential ever reaches the browser.
 *
 * Security:
 *   - The photo id is read from the URL; we resolve the storage_path strictly
 *     from the DB row (RLS-enforced via the public client), so a caller can
 *     only ever reach the object already linked to that id. No arbitrary B2
 *     key, path traversal, or credential is reachable.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Validate the id is a non-empty, path-safe string (UUIDs only).
  if (!id || typeof id !== "string" || id.length === 0 || id.includes("/") || id.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const supabase = createPublicClient();

  const { data: photo, error } = await supabase
    .from("photos")
    .select("storage_path, filename")
    .eq("id", id)
    .maybeSingle();

  if (error || !photo) {
    return new Response("Not found", { status: 404 });
  }

  const cacheHeaders = {
    "Content-Type": contentTypeFromFilename(photo.filename),
    // Immutable photo content keyed by stable id -> safe to cache for 1 year.
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  try {
    if (isB2Path(photo.storage_path)) {
      const bytes = await getB2ObjectBytes(stripB2Prefix(photo.storage_path));
      return new Response(new Uint8Array(bytes).buffer, { status: 200, headers: cacheHeaders });
    }

    if (isR2Path(photo.storage_path)) {
      const bytes = await getR2ObjectBytes(stripR2Prefix(photo.storage_path));
      return new Response(new Uint8Array(bytes).buffer, { status: 200, headers: cacheHeaders });
    }

    // Legacy Supabase Storage photo.
    const { data: file, error: downloadError } = await supabase.storage
      .from("photos")
      .download(photo.storage_path);

    if (downloadError || !file) {
      return new Response("Not found", { status: 404 });
    }
    const bytes = await file.arrayBuffer();
    return new Response(bytes, { status: 200, headers: cacheHeaders });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
