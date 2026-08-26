import { S3Client } from "@aws-sdk/client-s3";

export type R2Env = {
  endpoint: string;
  region: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
};

/**
 * Reads Cloudflare R2 S3-compatible credentials from server-side environment
 * variables. Never expose these to the browser — only NEXT_PUBLIC_* values are
 * safe client-side, and the R2 credentials intentionally are NOT prefixed that
 * way. Throws if any required variable is missing, but the error message never
 * includes the secret values.
 *
 * R2 requires region "auto" (it ignores the physical region); the B2 adapter's
 * region string must not be reused here.
 */
export function getR2Env(): R2Env {
  const endpoint = process.env.R2_ENDPOINT;
  const region = process.env.R2_REGION;
  const bucketName = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  const missing: string[] = [];
  if (!endpoint) missing.push("R2_ENDPOINT");
  if (!region) missing.push("R2_REGION");
  if (!bucketName) missing.push("R2_BUCKET_NAME");
  if (!accessKeyId) missing.push("R2_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("R2_SECRET_ACCESS_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Konfigurasi Cloudflare R2 belum lengkap. Variabel berikut tidak ditemukan: ${missing.join(", ")}.`
    );
  }

  // R2 ignores the physical region; the SDK requires a non-empty region and
  // "auto" is the value Cloudflare documents for S3-compatible access.
  const resolvedRegion = region === "auto" ? "auto" : "auto";

  return {
    endpoint: endpoint!,
    region: resolvedRegion,
    bucketName: bucketName!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
  };
}

/**
 * Creates a server-side S3-compatible client for Cloudflare R2.
 *
 * - Uses forcePathStyle for parity with the B2 adapter (R2 also supports
 *   path-style addressing via the endpoint host).
 * - This is a SEPARATE S3Client instance from the B2 client — never share the
 *   B2 client for R2 operations.
 * - Never uses the Supabase service-role key.
 * - Credentials come exclusively from getR2Env() (server-side env).
 */
export function createR2Client(): S3Client {
  const { endpoint, region, accessKeyId, secretAccessKey } = getR2Env();

  return new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}
