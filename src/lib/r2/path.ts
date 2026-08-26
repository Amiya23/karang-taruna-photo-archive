/**
 * Pure helpers for the R2 storage_path convention (no SDK imports, so this
 * module is safe to use in client or server bundles).
 *
 * Convention (mirrors src/lib/b2/path.ts):
 *   - Legacy/unprefixed storage_path  -> Supabase Storage (photos bucket)
 *   - "b2:"-prefixed storage_path      -> Backblaze B2 (karang-taruna-photos)
 *   - "r2:"-prefixed storage_path      -> Cloudflare R2 (karang-taruna-photo-archive)
 *
 * The actual R2 object key is the storage_path WITHOUT the "r2:" prefix.
 *
 * This module is intentionally decoupled from any S3 client. The R2 adapter
 * (src/lib/r2/*) can be wired into routing in a later phase (R2-3+) without
 * touching B2 behavior.
 */

export const R2_PATH_PREFIX = "r2:";

export function isR2Path(storagePath: string | null | undefined): boolean {
  return typeof storagePath === "string" && storagePath.startsWith(R2_PATH_PREFIX);
}

export function stripR2Prefix(storagePath: string): string {
  return isR2Path(storagePath)
    ? storagePath.slice(R2_PATH_PREFIX.length)
    : storagePath;
}
