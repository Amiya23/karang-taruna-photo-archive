import { test } from "node:test";
import assert from "node:assert/strict";
import { photoPublicUrl, resolveImageUrl, stablePhotoImageUrl, r2PublicUrl, contentTypeFromFilename } from "./.tmptest/photo-url.js";

test("photoPublicUrl builds Supabase public URL", () => {
  const url = photoPublicUrl("2023/abc/def.jpg");
  assert.ok(url.includes("/storage/v1/object/public/photos/2023/abc/def.jpg"));
});

test("resolveImageUrl passes through absolute URLs", () => {
  assert.equal(resolveImageUrl("https://x/y.jpg"), "https://x/y.jpg");
});

test("resolveImageUrl maps legacy storage_path to Supabase public URL", () => {
  assert.ok(resolveImageUrl("2023/abc/def.jpg").includes("/storage/v1/object/public/photos/"));
});

test("stablePhotoImageUrl builds same-origin stable route", () => {
  assert.equal(stablePhotoImageUrl("11111111-2222-3333-4444-555555555555"), "/api/photos/11111111-2222-3333-4444-555555555555/image");
});

test("stablePhotoImageUrl encodes the id", () => {
  assert.equal(stablePhotoImageUrl("a/b"), "/api/photos/a%2Fb/image");
});

test("r2PublicUrl builds the Cloudflare custom-domain URL from an r2: path", () => {
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL = "https://media.karangtarunart016.my.id";
  const url = r2PublicUrl("r2:2024/3b4785e1-7d60-41da-af2f-4e8ad6e2fdc1/1787753540292-_r2_6b_test.jpg");
  assert.equal(url, "https://media.karangtarunart016.my.id/2024/3b4785e1-7d60-41da-af2f-4e8ad6e2fdc1/1787753540292-_r2_6b_test.jpg");
});

test("r2PublicUrl keeps the path separator and strips only the r2: tag", () => {
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL = "https://media.karangtarunart016.my.id/";
  const url = r2PublicUrl("r2:2023/9a7b113c/4a6dcfd35c20-pawai2023-15.jpg");
  assert.equal(url, "https://media.karangtarunart016.my.id/2023/9a7b113c/4a6dcfd35c20-pawai2023-15.jpg");
});

test("r2PublicUrl never embeds credentials or a presigned query", () => {
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL = "https://media.karangtarunart016.my.id";
  const url = r2PublicUrl("r2:2024/abc/def.jpg");
  assert.ok(!url.includes("X-Amz"));
  assert.ok(!url.includes("signature"));
  assert.ok(!url.includes("accessKeyId"));
});

test("contentTypeFromFilename maps extensions", () => {
  assert.equal(contentTypeFromFilename("a.png"), "image/png");
  assert.equal(contentTypeFromFilename("a.WEBP"), "image/webp");
  assert.equal(contentTypeFromFilename("a.jpeg"), "image/jpeg");
  assert.equal(contentTypeFromFilename(null), "image/jpeg");
  assert.equal(contentTypeFromFilename(""), "image/jpeg");
});
