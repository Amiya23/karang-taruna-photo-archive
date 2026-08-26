import { test } from "node:test";
import assert from "node:assert/strict";
import { isR2Path, stripR2Prefix, R2_PATH_PREFIX } from "../.tmptest/r2/path.js";

test("isR2Path detects r2: prefix", () => {
  assert.equal(isR2Path("r2:2026/abc/123-foto.jpg"), true);
  assert.equal(isR2Path("2026/abc/123-foto.jpg"), false);
  assert.equal(isR2Path(""), false);
  assert.equal(isR2Path(null), false);
  assert.equal(isR2Path(undefined), false);
});

test("stripR2Prefix removes only the r2: tag", () => {
  assert.equal(stripR2Prefix("r2:2026/abc/123-foto.jpg"), "2026/abc/123-foto.jpg");
  // legacy path unchanged
  assert.equal(stripR2Prefix("2026/abc/123-foto.jpg"), "2026/abc/123-foto.jpg");
  assert.equal(stripR2Prefix(""), "");
});

test("R2_PATH_PREFIX constant", () => {
  assert.equal(R2_PATH_PREFIX, "r2:");
});

test("round-trip: r2 path -> key -> r2 path", () => {
  const sp = "r2:2026/event/ts-name.jpg";
  const key = stripR2Prefix(sp);
  assert.equal(key, "2026/event/ts-name.jpg");
  assert.equal(`${R2_PATH_PREFIX}${key}`, sp);
});

test("b2: paths are not detected as R2", () => {
  assert.equal(isR2Path("b2:2026/abc/123-foto.jpg"), false);
});

test("legacy paths are not detected as R2", () => {
  assert.equal(isR2Path("2026/abc/123-foto.jpg"), false);
  assert.equal(isR2Path("abc.jpg"), false);
});
