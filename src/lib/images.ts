import "server-only";
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

/**
 * Validates and re-encodes an uploaded photo. Re-encoding means we never store
 * or serve the original bytes: it strips EXIF/GPS metadata and anything that
 * isn't a real image fails here.
 */
export async function processUpload(file: File): Promise<{ data: Buffer; mime: "image/jpeg"; width: number; height: number }> {
  if (!ALLOWED.has(file.type)) throw new UploadError("Please upload photos (JPG, PNG, WebP or HEIC).");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("Each photo must be under 6MB.");
  try {
    const { data, info } = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 50_000_000 })
      .rotate() // respect phone orientation before metadata is dropped
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { data, mime: "image/jpeg", width: info.width, height: info.height };
  } catch {
    throw new UploadError("One of the photos couldn't be read. Please try a different photo.");
  }
}

export class UploadError extends Error {}
