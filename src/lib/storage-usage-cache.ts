/**
 * Server-only TTL cache for the combined storage-usage calculation.
 *
 * getStorageUsageBytes() scans Supabase Storage (recursively) AND the Backblaze
 * B2 bucket (paginated ListObjectsV2). On the full 8.5 GB / ~14.5k-object
 * archive this is the single most expensive dashboard call, so we memoize the
 * combined result for ~5 minutes.
 *
 * Design notes (per Phase 6D):
 * - Server-only: this module is imported solely from the admin dashboard page.
 * - No DB columns / migrations, no service-role credentials, no new deps.
 * - getStorageUsageBytes() remains the source of truth; we only wrap it.
 * - In-flight dedupe prevents duplicate scans when several /admin requests
 *   arrive concurrently while the cache is cold.
 * - The cache is intentionally per-process / per-instance. It is NOT shared
 *   across Vercel serverless instances; correctness is preserved when a cold
 *   instance simply recomputes.
 */

import { getStorageUsageBytes } from "@/lib/supabase/queries";
import {
  type CacheState,
  type CachedValue,
  memoizeTtl,
} from "@/lib/cache-ttl";

const STORAGE_USAGE_TTL_MS = 5 * 60 * 1000; // ~5 minutes

// Owned by this module; one cache per server process.
const state: CacheState<number> = { cache: null, inflight: null };

/**
 * Returns cached storage usage bytes, recomputing at most once per TTL window.
 * Falls back to 0 (matching getStorageUsageBytes' safe failure) on error.
 */
export async function getStorageUsageBytesCached(now: number = Date.now()): Promise<number> {
  try {
    return await memoizeTtl(
      getStorageUsageBytes,
      state,
      now,
      STORAGE_USAGE_TTL_MS
    );
  } catch {
    return 0;
  }
}

// Exported for tests / introspection only; not part of the public API surface.
export const __storageUsageCache = state as CacheState<number> & {
  set: (entry: CachedValue<number> | null) => void;
  clear: () => void;
};
__storageUsageCache.set = (entry) => {
  state.cache = entry;
};
__storageUsageCache.clear = () => {
  state.cache = null;
  state.inflight = null;
};
export const STORAGE_USAGE_TTL = STORAGE_USAGE_TTL_MS;
