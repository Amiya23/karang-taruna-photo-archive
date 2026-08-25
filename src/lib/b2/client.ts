import { S3Client } from "@aws-sdk/client-s3";

export type B2Env = {
  endpoint: string;
  region: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
};

/**
 * Reads Backblaze B2 S3-compatible credentials from server-side environment
 * variables. Never expose these to the browser — only NEXT_PUBLIC_* values are
 * safe client-side, and the B2 credentials intentionally are NOT prefixed that
 * way. Throws if any required variable is missing, but the error message never
 * includes the secret values.
 */
export function getB2Env(): B2Env {
  const endpoint = process.env.B2_ENDPOINT;
  const region = process.env.B2_REGION;
  const bucketName = process.env.B2_BUCKET_NAME;
  const accessKeyId = process.env.B2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.B2_SECRET_ACCESS_KEY;

  const missing: string[] = [];
  if (!endpoint) missing.push("B2_ENDPOINT");
  if (!region) missing.push("B2_REGION");
  if (!bucketName) missing.push("B2_BUCKET_NAME");
  if (!accessKeyId) missing.push("B2_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("B2_SECRET_ACCESS_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Konfigurasi Backblaze B2 belum lengkap. Variabel berikut tidak ditemukan: ${missing.join(", ")}.`
    );
  }

  return {
    endpoint: endpoint!,
    region: region!,
    bucketName: bucketName!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
  };
}

/**
 * Creates a server-side S3-compatible client for Backblaze B2.
 *
 * - Uses forcePathStyle because B2's S3-compatible API is addressed via the
 *   endpoint host (not virtual-hosted bucket subdomains).
 * - Never uses the Supabase service-role key.
 * - Credentials come exclusively from getB2Env() (server-side env).
 */
export function createB2Client(): S3Client {
  const { endpoint, region, accessKeyId, secretAccessKey } = getB2Env();

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
