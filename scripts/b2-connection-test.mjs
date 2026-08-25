// Dev-only Backblaze B2 connection test. Run with:
//   node scripts/b2-connection-test.mjs
// This script is NOT imported by the app and is not part of the production
// bundle. It only verifies connectivity, endpoint, credentials, and bucket
// access. It never prints secret values.
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

function loadB2Env() {
  const endpoint = process.env.B2_ENDPOINT;
  const region = process.env.B2_REGION;
  const bucketName = process.env.B2_BUCKET_NAME;
  const accessKeyId = process.env.B2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.B2_SECRET_ACCESS_KEY;

  const missing = [];
  if (!endpoint) missing.push("B2_ENDPOINT");
  if (!region) missing.push("B2_REGION");
  if (!bucketName) missing.push("B2_BUCKET_NAME");
  if (!accessKeyId) missing.push("B2_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("B2_SECRET_ACCESS_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Konfigurasi B2 belum lengkap. Variabel tidak ditemukan: ${missing.join(", ")}.`
    );
  }
  return { endpoint, region, bucketName, accessKeyId, secretAccessKey };
}

async function main() {
  const env = loadB2Env();

  console.log("[b2-test] Endpoint :", env.endpoint);
  console.log("[b2-test] Region   :", env.region);
  console.log("[b2-test] Bucket   :", env.bucketName);
  console.log("[b2-test] Membuat S3 client (forcePathStyle)...");

  const client = new S3Client({
    endpoint: env.endpoint,
    region: env.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  });

  const command = new ListObjectsV2Command({
    Bucket: env.bucketName,
    MaxKeys: 20,
  });

  const result = await client.send(command);

  const keys = (result.Contents ?? []).map((o) => o.Key ?? "");
  console.log(`[b2-test] Berhasil list. ${keys.length} object(s) pada halaman ini.`);
  for (const k of keys) console.log("  -", k);

  const target = "DSCF9386.JPG";
  const found = keys.some((k) => k.toUpperCase() === target.toUpperCase());
  console.log(`[b2-test] ${target} ditemukan: ${found ? "YA" : "TIDAK"}`);

  if (!found) {
    console.log(
      "[b2-test] Catatan: file test mungkin berada di prefix/folder lain atau belum di-root bucket."
    );
  }

  console.log("[b2-test] Koneksi B2 berhasil.");
}

main().catch((err) => {
  console.error("[b2-test] GAGAL:", err && err.message ? err.message : err);
  process.exit(1);
});
