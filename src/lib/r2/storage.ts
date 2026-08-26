/**
 * Isolated Cloudflare R2 storage adapter (server-side, framework-free).
 *
 * Provides low-level object operations against the R2 S3-compatible bucket:
 * upload, head/metadata, byte retrieval, delete, and list.
 *
 * This adapter mirrors src/lib/b2/storage.ts in structure and behavior so that
 * later dual-provider routing (R2-3+) can swap providers with minimal change.
 * It is intentionally NOT wired into any application flow yet (R2-2 scope):
 * no upload/delete/list is invoked by the app, and no routing imports it.
 *
 * Security:
 * - Bucket name is ALWAYS taken from the server-side environment (getR2Env),
 *   never from caller input.
 * - Object keys are validated as non-empty strings but NOT rewritten/normalized,
 *   so existing storage_path values (once migrated to "r2:") pass through
 *   unchanged.
 * - Credentials come only from createR2Client()/getR2Env (server env); they are
 *   never exposed to the browser and never logged.
 *
 * Usage counting (equivalent of B2's getB2UsageBytes) is intentionally NOT
 * implemented here: it requires a live paginated ListObjectsV2 scan, which would
 * perform network operations. It is documented for a later phase (R2-3+) where
 * the storage-usage dashboard can sum R2 bytes alongside B2/Supabase.
 */

import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { createR2Client, getR2Env } from "./client";

export type ObjectMetadata = {
  exists: boolean;
  size?: number;
  contentType?: string;
  lastModified?: Date;
};

export type UploadInput = Uint8Array | Buffer | string;

function assertKey(key: unknown): string {
  if (typeof key !== "string" || key.trim().length === 0) {
    throw new Error("Kunci objek R2 tidak valid (harus string non-kosong).");
  }
  return key;
}

function bucketName(): string {
  // Bucket is resolved from server-side env only — never from caller input.
  return getR2Env().bucketName;
}

/** Upload an object. `key` is used verbatim (no normalization). */
export async function uploadObject(
  key: string,
  body: UploadInput,
  contentType?: string
): Promise<void> {
  const objectKey = assertKey(key);
  const client: S3Client = createR2Client();

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
  const client: S3Client = createR2Client();

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

/** Retrieve an object's bytes (server-side). */
export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const objectKey = assertKey(key);
  const client: S3Client = createR2Client();

  const result = await client.send(
    new GetObjectCommand({ Bucket: bucketName(), Key: objectKey })
  );

  if (!result.Body) {
    throw new Error("Objek R2 tidak memiliki body.");
  }
  return result.Body.transformToByteArray();
}

/** Delete a single object. */
export async function deleteObject(key: string): Promise<void> {
  const objectKey = assertKey(key);
  const client: S3Client = createR2Client();

  await client.send(
    new DeleteObjectCommand({ Bucket: bucketName(), Key: objectKey })
  );
}

/** List object keys, optionally under a prefix (one page, up to maxKeys). */
export async function listObjects(
  prefix?: string,
  maxKeys = 100
): Promise<string[]> {
  const client: S3Client = createR2Client();

  const result = await client.send(
    new ListObjectsV2Command({
      Bucket: bucketName(),
      Prefix: prefix,
      MaxKeys: maxKeys,
    })
  );

  return (result.Contents ?? [])
    .map((item) => item.Key ?? "")
    .filter((k): k is string => k.length > 0);
}

/**
 * Total bytes stored across the R2 bucket (recursive list).
 *
 * Lists every object (following pagination tokens) and sums the Size reported
 * by R2's S3-compatible ListObjectsV2. Returns 0 on any error so the dashboard
 * degrades gracefully. Server-side only — never call from a client.
 *
 * NOTE: This is intentionally NOT invoked by the storage-usage dashboard in
 * R2-3 (wiring deferred to a later phase to avoid performing live R2 scans
 * automatically). It mirrors getB2UsageBytes in behavior/structure.
 */
export async function getR2UsageBytes(): Promise<number> {
  try {
    const client: S3Client = createR2Client();
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
    console.error("[getR2UsageBytes]", error);
    return 0;
  }
}
