/**
 * Isolated Backblaze B2 storage adapter (server-side, framework-free).
 *
 * Provides low-level object operations against the B2 S3-compatible bucket:
 * upload, head/metadata, presigned GET URL, delete, list, and byte retrieval.
 *
 * This adapter is intentionally decoupled from the application's Supabase
 * Storage usage. Supabase Storage remains the production storage; this module
 * is a standalone capability that can be tested and wired in later phases
 * without touching existing upload/gallery/download/delete logic.
 *
 * Security:
 * - Bucket name is ALWAYS taken from the server-side environment (getB2Env),
 *   never from caller input.
 * - Object keys are validated as non-empty strings but NOT rewritten/normalized,
 *   so existing storage_path values pass through unchanged.
 * - Credentials come only from createB2Client()/getB2Env (server env); they are
 *   never exposed to the browser and never logged.
 * - Presigned URLs are never logged in production code.
 */

import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createB2Client, getB2Env } from "./client";

/** Default presigned-GET expiry (seconds). B2/S3 max is 7 days (604800). */
export const DEFAULT_PRESIGN_EXPIRY_SECONDS = 3600;

export type ObjectMetadata = {
  exists: boolean;
  size?: number;
  contentType?: string;
  lastModified?: Date;
};

export type UploadInput = Uint8Array | Buffer | string;

function assertKey(key: unknown): string {
  if (typeof key !== "string" || key.trim().length === 0) {
    throw new Error("Kunci objek B2 tidak valid (harus string non-kosong).");
  }
  return key;
}

function bucketName(): string {
  // Bucket is resolved from server-side env only — never from caller input.
  return getB2Env().bucketName;
}

/** Upload an object. `key` is used verbatim (no normalization). */
export async function uploadObject(
  key: string,
  body: UploadInput,
  contentType?: string
): Promise<void> {
  const objectKey = assertKey(key);
  const client: S3Client = createB2Client();

  const command = new PutObjectCommand({
    Bucket: bucketName(),
    Key: objectKey,
    Body: body,
    ContentType: contentType,
  });

  await client.send(command);
}

/** Fetch metadata for an object, or report non-existence without throwing. */
export async function getObjectMetadata(key: string): Promise<ObjectMetadata> {
  const objectKey = assertKey(key);
  const client: S3Client = createB2Client();

  try {
    const result = await client.send(
      new HeadObjectCommand({ Bucket: bucketName(), Key: objectKey })
    );
    return {
      exists: true,
      size: result.ContentLength,
      contentType: result.ContentType,
      lastModified: result.LastModified,
    };
  } catch (error) {
    const code = (error as { name?: string })?.name;
    if (code === "NotFound" || code === "NoSuchKey") {
      return { exists: false };
    }
    throw error;
  }
}

/** Create a presigned GET URL for a private object. */
export async function createPresignedGetUrl(
  key: string,
  expiresIn: number = DEFAULT_PRESIGN_EXPIRY_SECONDS
): Promise<string> {
  const objectKey = assertKey(key);
  const client: S3Client = createB2Client();

  const command = new GetObjectCommand({
    Bucket: bucketName(),
    Key: objectKey,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/** Delete a single object. */
export async function deleteObject(key: string): Promise<void> {
  const objectKey = assertKey(key);
  const client: S3Client = createB2Client();

  await client.send(
    new DeleteObjectCommand({ Bucket: bucketName(), Key: objectKey })
  );
}

/** List object keys, optionally under a prefix (one page, up to maxKeys). */
export async function listObjects(
  prefix?: string,
  maxKeys = 100
): Promise<string[]> {
  const client: S3Client = createB2Client();

  const result = await client.send(
    new ListObjectsV2Command({
      Bucket: bucketName(),
      Prefix: prefix,
      MaxKeys: maxKeys,
    })
  );

  return (result.Contents ?? []).map((item) => item.Key ?? "").filter(
    (k): k is string => k.length > 0
  );
}

/** Retrieve an object's bytes (server-side). */
export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const objectKey = assertKey(key);
  const client: S3Client = createB2Client();

  const result = await client.send(
    new GetObjectCommand({ Bucket: bucketName(), Key: objectKey })
  );

  if (!result.Body) {
    throw new Error("Objek B2 tidak memiliki body.");
  }
  return result.Body.transformToByteArray();
}

/**
 * Total bytes stored across the B2 bucket (recursive list).
 *
 * Lists every object (following pagination tokens) and sums the Size reported by
 * B2's S3-compatible ListObjectsV2. Returns 0 on any error so the dashboard
 * degrades gracefully. This is server-side only — never call from a client.
 */
export async function getB2UsageBytes(): Promise<number> {
  try {
    const client: S3Client = createB2Client();
    const Bucket = bucketName();
    let total = 0;
    let continuationToken: string | undefined;

    do {
      const result = await client.send(
        new ListObjectsV2Command({ Bucket, ContinuationToken: continuationToken })
      );
      for (const item of result.Contents ?? []) {
        if (typeof item.Size === "number") total += item.Size;
      }
      continuationToken = result.IsTruncated
        ? result.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return total;
  } catch (error) {
    console.error("[getB2UsageBytes]", error);
    return 0;
  }
}
