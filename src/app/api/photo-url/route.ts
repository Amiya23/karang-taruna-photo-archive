import { type NextRequest } from "next/server";
import { resolvedImageUrl } from "@/lib/photo-url-server";
import { B2_PATH_PREFIX } from "@/lib/b2/path";

// Resolved per request (presigned URLs are time-limited); never prerender.
export const dynamic = "force-dynamic";

/**
 * GET /api/photo-url?path=<storage_path>
 *
 * Returns the publicly-renderable URL for a given storage_path:
 *   - legacy/unprefixed -> Supabase public object URL
 *   - "b2:" prefix     -> B2 presigned GET URL (generated server-side)
 *
 * Security:
 *   - B2 credentials never leave the server; the browser only receives a URL.
 *   - The path is read from a DB-resolved value by callers; we additionally
 *     reject anything that is not a plain storage_path string (no traversal).
 */
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");

  if (!path || typeof path !== "string" || path.length === 0) {
    return new Response("Bad request", { status: 400 });
  }
  // Disallow absolute URLs or suspicious characters from being echoed back.
  if (path.includes("..") || path.includes("//")) {
    return new Response("Bad request", { status: 400 });
  }

  try {
    const url = await resolvedImageUrl(
      path.startsWith(B2_PATH_PREFIX) ? path : path
    );
    return Response.json({ url });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
