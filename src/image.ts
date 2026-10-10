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
