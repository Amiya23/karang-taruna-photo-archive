/**
 * Framework-free, dependency-free TTL memory cache helper.
 *
 * This module is intentionally pure (no imports) so it can be unit-tested in
 * isolation without pulling in Supabase, B2, or Next. The storage-usage cache
 * wrapper binds a real data source to this helper.
 */

export type CachedValue<T> = { value: T; expiresAt: number };

export type CacheState<T> = {
  cache: CachedValue<T> | null;
  inflight: Promise<T> | null;
};

function isFresh<T>(entry: CachedValue<T> | null, now: number): entry is CachedValue<T> {
  return entry !== null && entry.expiresAt > now;
}

/**
 * Returns a value from `source`, memoized with a TTL.
 *
 * - If a fresh cache entry exists, returns it WITHOUT calling `source`.
 * - Concurrent callers share a single in-flight `source()` call (dedupe), so a
 *   burst of requests cannot trigger duplicate expensive scans.
 * - `now` and `ttlMs` are injectable so tests can drive expiry deterministically.
 *
 * The cache lives in the provided `state` object, which the caller owns (a
 * module-level variable in the real wrapper). It is intentionally NOT globally
 * shared across server instances — correctness is preserved when the cache is
 * cold elsewhere (we simply recompute).
 */
export async function memoizeTtl<T>(
  source: () => Promise<T>,
  state: CacheState<T>,
  now: number,
  ttlMs: number
): Promise<T> {
  if (isFresh(state.cache, now)) {
    return state.cache.value;
  }

  // A scan is already in flight for this key — join it instead of starting another.
  if (state.inflight) {
    return state.inflight;
  }

  const run = (async () => {
    const value = await source();
    state.cache = { value, expiresAt: now + ttlMs };
    return value;
  })();

  state.inflight = run;
  try {
    return await run;
  } finally {
    state.inflight = null;
  }
}
