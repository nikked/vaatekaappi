import type { Pixels } from "./color";

// Color extraction doesn't need full resolution; 128px keeps it instant.
export const loadPixels = async (file: Blob, maxSize = 128): Promise<Pixels> => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = new OffscreenCanvas(width, height).getContext("2d");
  if (!ctx) throw new Error("2D canvas not available");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { data: ctx.getImageData(0, 0, width, height).data, width, height };
};

// Phone photos are ~12 MP; segmentation and storage don't need more than this.
export const downscale = async (file: Blob, maxSize = 1024): Promise<Blob> => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas not available");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
};

/** RGBA → RGB composited onto white. */
export const flattenOnWhite = (rgba: Uint8ClampedArray | Uint8Array): Uint8ClampedArray => {
  const rgb = new Uint8ClampedArray((rgba.length / 4) * 3);
  for (let i = 0, j = 0; i + 3 < rgba.length; i += 4, j += 3) {
    const alpha = (rgba[i + 3] ?? 0) / 255;
    for (let c = 0; c < 3; c++) rgb[j + c] = Math.round((rgba[i + c] ?? 0) * alpha + 255 * (1 - alpha));
  }
  return rgb;
};

/** Copy of an RGBA image with alpha replaced by a one-channel mask. */
export const withAlpha = (
  rgba: Uint8ClampedArray | Uint8Array,
  mask: Uint8ClampedArray | Uint8Array,
): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(rgba);
  for (let i = 0; i < mask.length; i++) out[i * 4 + 3] = mask[i] ?? 0;
  return out;
};
