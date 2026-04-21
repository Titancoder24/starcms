import sharp from "sharp";
import { encode as encodeBlurhash } from "blurhash";
import { put, del } from "@vercel/blob";
import { createMediaRecord } from "@/lib/api/media";

const WIDTHS = [320, 640, 960, 1280, 1920];
const FORMATS: Array<"webp" | "avif"> = ["webp", "avif"];

// Multer-compatible file shape (works for direct uploads and URL fetches)
export type UploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export async function processMediaUpload(
  file: UploadFile,
  siteId: string,
  altText: string
) {
  const image = sharp(file.buffer);
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  // Compute blurhash from a small thumbnail
  const thumbBuffer = await image.clone().resize(32, 32, { fit: "inside" }).raw().ensureAlpha().toBuffer();
  const thumbWidth = Math.min(32, width);
  const thumbHeight = Math.min(32, height);
  let blurhash = "";
  try {
    const pixels = new Uint8ClampedArray(thumbBuffer);
    blurhash = encodeBlurhash(pixels, thumbWidth, thumbHeight, 4, 4);
  } catch { /* skip */ }

  // Upload original
  const ext = file.originalname.split(".").pop() ?? "jpg";
  const baseName = `media/${siteId}/${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const originalBlob = await put(`${baseName}.${ext}`, file.buffer, {
    access: "public",
    contentType: file.mimetype,
  });

  // Generate variants
  const variants: Array<{ width: number; height: number; url: string; format: string }> = [];

  for (const targetWidth of WIDTHS) {
    if (targetWidth > width) continue;
    for (const format of FORMATS) {
      const variantBuffer = await image
        .clone()
        .resize(targetWidth, undefined, { withoutEnlargement: true })
        [format]({ quality: 80 })
        .toBuffer();

      const variantBlob = await put(
        `${baseName}-${targetWidth}.${format}`,
        variantBuffer,
        { access: "public", contentType: `image/${format}` }
      );

      const variantMeta = await sharp(variantBuffer).metadata();
      variants.push({
        width: variantMeta.width ?? targetWidth,
        height: variantMeta.height ?? 0,
        url: variantBlob.url,
        format,
      });
    }
  }

  return createMediaRecord(siteId, {
    url: originalBlob.url,
    blobKey: originalBlob.pathname,
    alt: altText,
    width,
    height,
    format: ext,
    sizeBytes: file.size,
    blurhash,
    variants,
  });
}

export async function deleteMediaFromStorage(blobKey: string): Promise<void> {
  try {
    await del(blobKey);
  } catch { /* ignore */ }
}
