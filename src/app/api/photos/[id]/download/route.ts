import { type NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { contentDisposition } from "@/lib/download";

// Downloads are per-request; never prerender / cache at build time.
export const dynamic = "force-dynamic";

/**
 * GET /api/photos/[id]/download
 *
 * Public forced-download of a single photo.
 *
 * Security model:
 *  - The photo is resolved strictly by its database row id; the caller can
 *    NEVER supply a raw storage path. The storage_path is read from the row,
 *    so a request can only ever reach the object already linked to that photo.
 *  - Uses the public (anon) Supabase client, so no service-role secret ever
 *    touches the browser, and RLS / storage policies are still enforced.
 *  - Because the gallery is intentionally public, this endpoint is public too.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || typeof id !== "string") {
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

  let bytes: ArrayBuffer;
  let contentType: string;

  if (photo.storage_path.startsWith("b2:")) {
    const { getObjectBytes } = await import("@/lib/b2/storage");
    const { stripB2Prefix } = await import("@/lib/b2/path");
    const data = await getObjectBytes(stripB2Prefix(photo.storage_path));
    bytes = new Uint8Array(data).buffer;
    contentType = "image/jpeg";
  } else if (photo.storage_path.startsWith("r2:")) {
    const { getObjectBytes } = await import("@/lib/r2/storage");
    const { stripR2Prefix } = await import("@/lib/r2/path");
    const data = await getObjectBytes(stripR2Prefix(photo.storage_path));
    bytes = new Uint8Array(data).buffer;
    contentType = "image/jpeg";
  } else {
    const { data: file, error: downloadError } = await supabase.storage
      .from("photos")
      .download(photo.storage_path);

    if (downloadError || !file) {
      return new Response("Not found", { status: 404 });
    }

    bytes = await file.arrayBuffer();
    contentType = file.type || "application/octet-stream";
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition(photo.filename ?? ""),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
