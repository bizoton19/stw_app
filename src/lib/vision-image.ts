import type { ReceiptImage } from "./parse-receipt";

/** Long edge for the model — enough for OCR, small enough to keep Gemini snappy. */
export const VISION_MAX_EDGE = 1600;
export const VISION_JPEG_QUALITY = 72;

/**
 * Downscale + re-encode before the vision call. The original upload is kept for
 * storage / the tab-photo sheet; only the model sees this smaller JPEG.
 *
 * Fail-open: if sharp is unavailable or the bytes are already tiny, return the input.
 */
export async function shrinkReceiptForVision(image: ReceiptImage): Promise<{
  image: ReceiptImage;
  ms: number;
  skipped?: string;
}> {
  const started = Date.now();
  if (image.bytes.length < 220_000) {
    return { image, ms: Date.now() - started, skipped: "already_small" };
  }
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(image.bytes)
      .rotate()
      .resize({
        width: VISION_MAX_EDGE,
        height: VISION_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: VISION_JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    if (out.length === 0 || out.length >= image.bytes.length) {
      return { image, ms: Date.now() - started, skipped: "no_gain" };
    }
    return {
      image: {
        name: image.name.replace(/\.[^.]+$/, "") + ".jpg",
        type: "image/jpeg",
        size: out.length,
        bytes: out,
      },
      ms: Date.now() - started,
    };
  } catch (err) {
    return {
      image,
      ms: Date.now() - started,
      skipped: err instanceof Error ? err.message.slice(0, 80) : "sharp_failed",
    };
  }
}
