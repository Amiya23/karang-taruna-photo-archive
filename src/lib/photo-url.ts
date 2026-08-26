export function photoPublicUrl(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${storagePath}`;
}

export function resolveImageUrl(value: string): string {
  return value.startsWith("http") ? value : photoPublicUrl(value);
}

/**
 * Stable, same-origin image URL for a photo row by its DB id.
 *
 * Used for B2 (and legacy) photos so the browser / Next.js Image optimizer /
 * CDN can cache the response under an immutable, per-id URL instead of a
 * volatile per-mount presigned B2 URL. The actual storage provider is resolved
 * server-side by the route handler; the B2 key is never part of the public URL.
 */
export function stablePhotoImageUrl(id: string): string {
  return `/api/photos/${encodeURIComponent(id)}/image`;
}

/**
 * Stable, public Cloudflare R2 custom-domain URL for an R2-backed object.
 *
 * - Uses ONLY the NEXT_PUBLIC_R2_PUBLIC_URL env var (client-safe, no secrets).
 * - Never generates a presigned URL and never embeds R2 credentials.
 * - `encodeURI` keeps "/" (path separators) intact while encoding any stray
 *   unsafe characters in the object key.
 *
 * This is the recommended public delivery path for R2 photos. The same-origin
 * /api/photos/<id>/image proxy remains available as fallback infrastructure.
 */
export function r2PublicUrl(storagePath: string): string {
  const base = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
  const key =
    typeof storagePath === "string" && storagePath.startsWith("r2:")
      ? storagePath.slice(3)
      : storagePath;
  return `${base}/${encodeURI(key)}`;
}

/** Best-effort Content-Type from a filename's extension (defaults to JPEG). */
export function contentTypeFromFilename(filename: string | null | undefined): string {
  const ext = (filename ?? "").toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "avif":
      return "image/avif";
    default:
      return "image/jpeg";
  }
}
