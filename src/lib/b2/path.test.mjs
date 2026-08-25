import { test } from "node:test";
import assert from "node:assert/strict";
import { isB2Path, stripB2Prefix, B2_PATH_PREFIX } from "../.tmptest/b2/path.js";

test("isB2Path detects b2: prefix", () => {
  assert.equal(isB2Path("b2:2026/abc/123-foto.jpg"), true);
  assert.equal(isB2Path("2026/abc/123-foto.jpg"), false);
  assert.equal(isB2Path(""), false);
  assert.equal(isB2Path(null), false);
  assert.equal(isB2Path(undefined), false);
});

test("stripB2Prefix removes only the b2: tag", () => {
  assert.equal(stripB2Prefix("b2:2026/abc/123-foto.jpg"), "2026/abc/123-foto.jpg");
  // legacy path unchanged
  assert.equal(stripB2Prefix("2026/abc/123-foto.jpg"), "2026/abc/123-foto.jpg");
  assert.equal(stripB2Prefix(""), "");
});

test("B2_PATH_PREFIX constant", () => {
  assert.equal(B2_PATH_PREFIX, "b2:");
});

test("round-trip: b2 path -> key -> b2 path", () => {
  const sp = "b2:2026/event/ts-name.jpg";
  const key = stripB2Prefix(sp);
  assert.equal(key, "2026/event/ts-name.jpg");
  assert.equal(`${B2_PATH_PREFIX}${key}`, sp);
});
