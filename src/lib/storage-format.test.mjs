import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBytes } from "./.tmptest/storage-format.js";

test("0 and negative report 0 B", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(-5), "0 B");
  assert.equal(formatBytes(NaN), "0 B");
});

test("bytes below 1 KB show raw byte count", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(1023), "1023 B");
});

test("KB uses one decimal", () => {
  assert.equal(formatBytes(1024), "1 KB");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(2560), "2.5 KB");
});

test("MB uses two decimals with trailing zeros trimmed", () => {
  assert.equal(formatBytes(1024 * 1024), "1 MB");
  assert.equal(formatBytes(1024 * 1024 * 1.5), "1.5 MB");
  assert.equal(formatBytes(1024 * 1024 * 2.25), "2.25 MB");
});

test("GB formatting", () => {
  assert.equal(formatBytes(1024 * 1024 * 1024), "1 GB");
  assert.equal(formatBytes(1024 * 1024 * 1024 * 1.25), "1.25 GB");
});

test("large terabyte value", () => {
  assert.equal(formatBytes(1024 * 1024 * 1024 * 1024), "1 TB");
});
