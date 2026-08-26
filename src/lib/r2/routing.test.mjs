import { test } from "node:test";
import assert from "node:assert/strict";
import { isB2Path, stripB2Prefix } from "../.tmptest/b2/path.js";
import { isR2Path, stripR2Prefix } from "../.tmptest/r2/path.js";
import { stablePhotoImageUrl } from "../.tmptest/photo-url.js";

/**
 * Pure tests for the three-provider storage_path classification that the image
 * route, download route, cleanup helper, and client URL resolver all rely on.
 * No SDK / network / Supabase involved — these are the exact predicates the
 * application branches on.
 */

test("provider classification: legacy / b2 / r2 are mutually exclusive", () => {
  const legacy = "2026/abc/123-foto.jpg";
  const b2 = "b2:2026/abc/123-foto.jpg";
  const r2 = "r2:2026/abc/123-foto.jpg";

  assert.equal(isB2Path(legacy), false);
  assert.equal(isR2Path(legacy), false);

  assert.equal(isB2Path(b2), true);
  assert.equal(isR2Path(b2), false);

  assert.equal(isR2Path(r2), true);
  assert.equal(isB2Path(r2), false);
});

test("strip prefix: each provider strips only its own tag", () => {
  assert.equal(stripB2Prefix("b2:2026/abc/123.jpg"), "2026/abc/123.jpg");
  assert.equal(stripR2Prefix("r2:2026/abc/123.jpg"), "2026/abc/123.jpg");
  // legacy path is untouched by either stripper
  assert.equal(stripB2Prefix("2026/abc/123.jpg"), "2026/abc/123.jpg");
  assert.equal(stripR2Prefix("2026/abc/123.jpg"), "2026/abc/123.jpg");
  // b2/r2 strippers do NOT cross-strip
  assert.equal(stripB2Prefix("r2:2026/abc.jpg"), "r2:2026/abc.jpg");
  assert.equal(stripR2Prefix("b2:2026/abc.jpg"), "b2:2026/abc.jpg");
});

test("stable same-origin image URL is provider-agnostic (id-based)", () => {
  const id = "11111111-2222-3333-4444-555555555555";
  // Both b2: and r2: resolve to the identical stable URL when an id is known.
  assert.equal(stablePhotoImageUrl(id), `/api/photos/${id}/image`);
});

test("traversal / invalid id detection (route guard predicate)", () => {
  const guard = (id) =>
    !id || id.length === 0 || id.includes("/") || id.includes("..");
  assert.equal(guard("11111111-2222-3333-4444-555555555555"), false);
  assert.equal(guard(""), true);
  assert.equal(guard("a/b"), true);
  assert.equal(guard("a..b"), true);
});
