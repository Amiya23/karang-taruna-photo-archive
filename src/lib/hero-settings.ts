/**
 * Pure hero-selection logic (no DB, no network) — the single source of truth
 * for which up-to-3 photos the public Hero collage shows, and in what order.
 *
 * Inputs:
 *   - settings: 3 nullable photo IDs chosen by the admin (slot 1,2,3).
 *   - heroPhotos: the photos that actually exist for those IDs, in slot order
 *     (already validated server-side; missing/deleted IDs are absent).
 *   - fallbackPhotos: recent public photos used to fill any empty/invalid slot
 *     so the Hero is never blank and never reuses a photo already in a slot.
 *
 * Rules:
 *   1. Slot order 1,2,3 is preserved from settings.
 *   2. Photos whose ID no longer exists are dropped (fallback fills the gap).
 *   3. The 3 slots must be distinct — if settings repeats an ID, later repeats
 *      are treated as empty and filled from fallback (no duplicate on the page).
 *   4. At most 3 photos are returned.
 *   5. Falls back gracefully when settings are absent/empty or photos missing.
 */
export type HeroSlot = {
  id: string;
  storagePath: string;
  filename: string;
  caption: string | null;
};

export function resolveHeroPhotos(
  heroPhotos: HeroSlot[],
  fallbackPhotos: HeroSlot[]
): HeroSlot[] {
  const chosen: HeroSlot[] = [];
  const usedIds = new Set<string>();

  // Fill from validated settings-derived photos (preserve slot order).
  for (const photo of heroPhotos) {
    if (chosen.length >= 3) break;
    if (usedIds.has(photo.id)) continue; // skip duplicate slot IDs
    chosen.push(photo);
    usedIds.add(photo.id);
  }

  // Fill remaining empty slots from fallback (no duplicates).
  for (const photo of fallbackPhotos) {
    if (chosen.length >= 3) break;
    if (usedIds.has(photo.id)) continue;
    chosen.push(photo);
    usedIds.add(photo.id);
  }

  return chosen;
}
