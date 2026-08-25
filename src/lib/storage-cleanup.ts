/**
 * Storage cleanup helper for photo deletion (framework-free, unit-testable).
 *
 * Removes objects from the public "photos" bucket. Every path passed here MUST
 * originate from a database row (photos.storage_path) — never from raw user
 * input. Used by the admin delete Event / delete Archive server actions so that
 * Supabase Storage objects are cleaned up BEFORE the corresponding database rows
 * are removed (Storage-first ordering, to avoid broken public gallery images).
 *
 * This module contains NO UI logic and NO direct database logic, and does not
 * import any Supabase client — the caller supplies the client (which must be an
 * admin-authenticated server client created via @/lib/supabase/server).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type StorageCleanupResult = {
  ok: boolean;
  removed: number;
  failed: string[];
};

const BUCKET = "photos";
const CHUNK_SIZE = 100;

export async function removePhotoObjects(
  supabase: SupabaseClient,
  paths: string[]
): Promise<StorageCleanupResult> {
  const unique = Array.from(
    new Set(
      (paths ?? [])
        .filter((p): p is string => typeof p === "string" && p.length > 0)
    )
  );

  if (unique.length === 0) {
    return { ok: true, removed: 0, failed: [] };
  }

  const failed: string[] = [];
  let removed = 0;

  for (let start = 0; start < unique.length; start += CHUNK_SIZE) {
    const chunk = unique.slice(start, start + CHUNK_SIZE);
    const { error } = await supabase.storage.from(BUCKET).remove(chunk);
    if (error) {
      failed.push(...chunk);
    } else {
      removed += chunk.length;
    }
  }

  return { ok: failed.length === 0, removed, failed };
}
