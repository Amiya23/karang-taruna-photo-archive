/**
 * Pure helpers for the hybrid storage_path convention (no SDK imports, so this
 * module is safe to use in client or server bundles).
 *
 * Convention:
 *   - Legacy/unprefixed storage_path  -> Supabase Storage (photos bucket)
 *   - "b2:"-prefixed storage_path      -> Backblaze B2 (karang-taruna-photos)
 *
 * The actual B2 object key is the storage_path WITHOUT the "b2:" prefix.
 */

export const B2_PATH_PREFIX = "b2:";

export function isB2Path(storagePath: string | null | undefined): boolean {
  return typeof storagePath === "string" && storagePath.startsWith(B2_PATH_PREFIX);
}

export function stripB2Prefix(storagePath: string): string {
  return isB2Path(storagePath)
    ? storagePath.slice(B2_PATH_PREFIX.length)
    : storagePath;
}
