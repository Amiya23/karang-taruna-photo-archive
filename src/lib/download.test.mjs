import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeDownloadFilename, contentDisposition } from "./.tmptest/download.js";

const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);

function hasControlOrLineFeed(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 13 || c === 10) return true;
  }
  return false;
}

test("preserves a normal filename with extension", () => {
  assert.equal(sanitizeDownloadFilename("IMG_1234.jpg"), "IMG_1234.jpg");
  assert.ok(contentDisposition("IMG_1234.jpg").startsWith("attachment;"));
  assert.ok(!hasControlOrLineFeed(contentDisposition("IMG_1234.jpg")));
});

test("removes carriage returns and line feeds", () => {
  const input = "a" + CR + LF + "b.png";
  assert.equal(sanitizeDownloadFilename(input), "ab.png");
  const cd = contentDisposition(input);
  assert.ok(cd.startsWith("attachment;"));
  assert.ok(!hasControlOrLineFeed(cd));
});

test("removes double quotes", () => {
  assert.equal(sanitizeDownloadFilename('a"b.png'), "ab.png");
  assert.ok(!contentDisposition('a"b.png').includes('"b'));
});

test("replaces path separators with underscores", () => {
  assert.equal(
    sanitizeDownloadFilename("folder/sub\\file.jpg"),
    "folder_sub_file.jpg"
  );
  assert.ok(!hasControlOrLineFeed(contentDisposition("folder/sub\\file.jpg")));
});

test("falls back to foto when empty or whitespace", () => {
  assert.equal(sanitizeDownloadFilename("   "), "foto");
  assert.equal(sanitizeDownloadFilename(""), "foto");
  assert.ok(!hasControlOrLineFeed(contentDisposition("")));
});

test("keeps unicode characters for the utf-8 filename part", () => {
  assert.equal(sanitizeDownloadFilename("Foto Cafe.png"), "Foto Cafe.png");
});

test("content-disposition is an attachment with ascii fallback and encoded utf-8", () => {
  const cd = contentDisposition('a"b.png');
  assert.ok(
    cd.indexOf('attachment; filename="ab.png"; filename*=UTF-8') === 0
  );
  assert.ok(!cd.includes('"b'));
  assert.ok(!hasControlOrLineFeed(cd));
});
