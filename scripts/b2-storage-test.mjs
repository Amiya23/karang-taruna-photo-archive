// Dev-only Backblaze B2 storage adapter test. Run with:
//   node --env-file=.env.local scripts/b2-storage-test.mjs
// NOT imported by the app; never part of the production bundle.
// Does NOT delete DSCF9386.JPG or any existing user photo — only the temporary
// object created by this script (prefix __phase6b_test__/).
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const TARGET = "DSCF9386.JPG";
const TEMP_KEY = "__phase6b_test__/verify.txt";
const TEMP_BODY = "phase6b adapter verification " + new Date().toISOString();

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

function bucket() {
  return loadB2Env().bucketName;
}

async function main() {
  const env = loadB2Env();
  const Bucket = env.bucketName;

  console.log("[b2-storage] Endpoint :", env.endpoint);
  console.log("[b2-storage] Region   :", env.region);
  console.log("[b2-storage] Bucket   :", Bucket);
  console.log("[b2-storage] Membuat S3 client (forcePathStyle)...");

  const client = new S3Client({
    endpoint: env.endpoint,
    region: env.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  });

  // 1. List existing objects + confirm DSCF9386.JPG present.
  const listed = await client.send(
    new ListObjectsV2Command({ Bucket, MaxKeys: 20 })
  );
  const keys = (listed.Contents ?? []).map((o) => o.Key ?? "");
  console.log(`[b2-storage] 1. List: ${keys.length} object(s).`);
  for (const k of keys) console.log("    -", k);
  const targetPresent = keys.some(
    (k) => k.toUpperCase() === TARGET.toUpperCase()
  );
  console.log(`[b2-storage]    ${TARGET} ada: ${targetPresent ? "YA" : "TIDAK"}`);

  // 2. Upload a temporary test object.
  await client.send(
    new PutObjectCommand({
      Bucket,
      Key: TEMP_KEY,
      Body: TEMP_BODY,
      ContentType: "text/plain",
    })
  );
  console.log(`[b2-storage] 2. Upload temp: ${TEMP_KEY}`);

  // 3. Head/metadata — verify existence + size.
  const head = await client.send(
    new HeadObjectCommand({ Bucket, Key: TEMP_KEY })
  );
  const exists = typeof head.ContentLength === "number";
  console.log(
    `[b2-storage] 3. Head: exists=${exists} size=${head.ContentLength} type=${head.ContentType}`
  );

  // 4. Presigned GET URL (do not log the URL value).
  const presigned = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket, Key: TEMP_KEY }),
    { expiresIn: 900 }
  );
  console.log(
    `[b2-storage] 4. Presigned URL dibuat (panjang ${presigned.length} karakter).`
  );

  // 5. Fetch via presigned URL and verify body matches.
  const res = await fetch(presigned);
  const text = await res.text();
  const fetchOk = res.ok && text === TEMP_BODY;
  console.log(
    `[b2-storage] 5. Fetch presigned: ok=${res.ok} bodyMatch=${text === TEMP_BODY}`
  );

  // 6. Delete the temporary object only.
  await client.send(new DeleteObjectCommand({ Bucket, Key: TEMP_KEY }));
  console.log(`[b2-storage] 6. Delete temp: ${TEMP_KEY}`);

  // 7. Verify temp is gone; DSCF9386.JPG still present.
  const after = await client.send(
    new ListObjectsV2Command({ Bucket, Prefix: "__phase6b_test__" })
  );
  const tempGone = (after.Contents ?? []).length === 0;

  const afterList = await client.send(
    new ListObjectsV2Command({ Bucket, MaxKeys: 20 })
  );
  const afterKeys = (afterList.Contents ?? []).map((o) => o.Key ?? "");
  const targetStillThere = afterKeys.some(
    (k) => k.toUpperCase() === TARGET.toUpperCase()
  );
  console.log(
    `[b2-storage] 7. Temp gone=${tempGone}; ${TARGET} masih ada=${targetStillThere}`
  );

  const allPassed =
    targetPresent && exists && fetchOk && tempGone && targetStillThere;
  if (!allPassed) {
    console.error("[b2-storage] GAGAL: salah satu langkah tidak sesuai.");
    process.exit(1);
  }
  console.log("[b2-storage] Semua langkah berhasil. DSCF9386.JPG tidak dihapus.");
}

main().catch((err) => {
  console.error("[b2-storage] GAGAL:", err && err.message ? err.message : err);
  process.exit(1);
});
