/**
 * Provider-aware storage cleanup for photo deletion (framework-free, unit-testable).
 *
 * Splits a list of storage_path values by provider and removes each from the
 * correct backend:
 *   - unprefixed            -> Supabase Storage "photos" bucket (chunked)
 *   - "b2:"-prefixed        -> Backblaze B2 object (key = strip prefix)
 *   - "r2:"-prefixed        -> Cloudflare R2 object (key = strip prefix)
 *
 * Reuses the existing Supabase removePhotoObjects helper so its chunking and
 * behavior are preserved. Storage-first ordering is the caller's responsibility:
 * if this returns ok=false, the caller must ABORT the DB deletion.
 *
 * This module imports the B2 adapter (aws-sdk) and Supabase client type only; it
 * contains no UI or DB-row logic. Callers supply the admin Supabase client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { removePhotoObjects } from "@/lib/storage-cleanup";
import { deleteObject as deleteB2Object } from "@/lib/b2/storage";
import { deleteObject as deleteR2Object } from "@/lib/r2/storage";
import { isB2Path, stripB2Prefix } from "@/lib/b2/path";
import { isR2Path, stripR2Prefix } from "@/lib/r2/path";

export type HybridCleanupResult = {
  ok: boolean;
  removed: number;
  failed: string[];
};

export async function removePhotoObjectsHybrid(
  supabase: SupabaseClient,
  paths: string[]
): Promise<HybridCleanupResult> {
  const unique = Array.from(
    new Set(
      (paths ?? []).filter(
        (p): p is string => typeof p === "string" && p.length > 0
      )
    )
  );

  if (unique.length === 0) {
    return { ok: true, removed: 0, failed: [] };
  }

  const supabasePaths = unique.filter((p) => !isB2Path(p) && !isR2Path(p));
  const b2Keys = unique.filter(isB2Path).map(stripB2Prefix);
  const r2Keys = unique.filter(isR2Path).map(stripR2Prefix);

  const failed: string[] = [];
  let removed = 0;

  // Supabase legacy paths: reuse existing chunked helper.
  if (supabasePaths.length > 0) {
    const result = await removePhotoObjects(supabase, supabasePaths);
    if (!result.ok) failed.push(...result.failed);
    removed += result.removed;
  }

  // B2 objects: delete one-by-one (B2 delete is a single-key op).
  for (const key of b2Keys) {
    try {
      await deleteB2Object(key);
      removed += 1;
    } catch {
      failed.push(`b2:${key}`);
    }
  }

  // R2 objects: delete one-by-one (R2 delete is a single-key op).
  for (const key of r2Keys) {
    try {
      await deleteR2Object(key);
      removed += 1;
    } catch {
      failed.push(`r2:${key}`);
    }
  }

  return { ok: failed.length === 0, removed, failed };
}
