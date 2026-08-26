import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveHeroPhotos } from "./.tmptest/hero-settings.js";

/** Pure tests for the hero photo selection + fallback logic. No DB / network. */

const mk = (id) => ({
  id,
  storagePath: `r2:2026/evt/${id}.jpg`,
  filename: `foto-${id}.jpg`,
  caption: null,
});

test("settings with 3 valid distinct photos -> exactly those 3 in slot order", () => {
  const chosen = [mk("a"), mk("b"), mk("c")];
  const fallback = [mk("x"), mk("y"), mk("z")];
  const result = resolveHeroPhotos(chosen, fallback);
  assert.equal(result.length, 3);
  assert.deepEqual(
    result.map((p) => p.id),
    ["a", "b", "c"]
  );
});

test("missing settings -> fallback fills all slots", () => {
  const result = resolveHeroPhotos([], [mk("x"), mk("y"), mk("z")]);
  assert.equal(result.length, 3);
  assert.deepEqual(
    result.map((p) => p.id),
    ["x", "y", "z"]
  );
});

test("partial settings (1 valid) -> remaining filled from fallback without duplicate", () => {
  const chosen = [mk("a")];
  const fallback = [mk("a"), mk("x"), mk("y")]; // fallback also contains 'a'
  const result = resolveHeroPhotos(chosen, fallback);
  assert.equal(result.length, 3);
  // 'a' from settings wins; fallback 'a' must NOT be duplicated.
  assert.deepEqual(
    result.map((p) => p.id),
    ["a", "x", "y"]
  );
});

test("deleted hero photo (absent from chosen) -> filled from fallback", () => {
  // settings referenced a,b,c but 'b' no longer exists, so chosen only has a,c.
  const chosen = [mk("a"), mk("c")];
  const fallback = [mk("x"), mk("y")];
  const result = resolveHeroPhotos(chosen, fallback);
  assert.equal(result.length, 3);
  assert.deepEqual(
    result.map((p) => p.id),
    ["a", "c", "x"]
  );
});

test("duplicate slot IDs in settings -> later duplicates treated as empty, filled from fallback", () => {
  // Admin UI rejects duplicates server-side, but the pure resolver must still
  // be safe if given [a, a, c].
  const chosen = [mk("a"), mk("a"), mk("c")];
  const fallback = [mk("x"), mk("y")];
  const result = resolveHeroPhotos(chosen, fallback);
  assert.equal(result.length, 3);
  assert.deepEqual(
    result.map((p) => p.id),
    ["a", "c", "x"]
  );
});

test("fewer than 3 available (no fallback) -> returns what exists, never exceeds 3", () => {
  const result = resolveHeroPhotos([mk("a")], []);
  assert.equal(result.length, 1);
  assert.deepEqual(result.map((p) => p.id), ["a"]);
});

test("no photos at all -> empty hero (UI shows placeholders)", () => {
  const result = resolveHeroPhotos([], []);
  assert.equal(result.length, 0);
});

test("never returns more than 3 even with huge fallback", () => {
  const fallback = Array.from({ length: 50 }, (_, i) => mk(`f${i}`));
  const result = resolveHeroPhotos([], fallback);
  assert.equal(result.length, 3);
});
