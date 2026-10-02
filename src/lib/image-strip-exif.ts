/**
 * Server-side EXIF stripping for uploaded photos.
 *
 * Uses Sharp to strip all EXIF metadata while preserving image dimensions
 * and format. This prevents camera make/model, GPS coordinates, and capture
 * timestamps from leaking into publicly accessible URLs.
 *
 * Usage: await stripExif(buffer, contentType)
 */
import sharp from "sharp";

export async function stripExif(
  buffer: Buffer,
  contentType?: string
): Promise<Buffer> {
  // Sharp does not expose removeExif in its TypeScript definitions in all versions.
  // Use the pipeline API with explicit format to force EXIF removal.
  const pipeline = sharp(buffer);

  // Preserve original format when possible; default to JPEG quality 90.
  if (contentType === "image/png") {
    return pipeline.png().toBuffer();
  }
  if (contentType === "image/webp") {
    return pipeline.webp().toBuffer();
  }
  return pipeline.jpeg({ quality: 90 }).toBuffer();
}
