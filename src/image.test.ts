import { describe, expect, it } from "vitest";
import {
  cropRgba,
  flattenOnWhite,
  imageFiles,
  opaqueBounds,
  withAlpha,
} from "./image";

describe("flattenOnWhite", () => {
  it("keeps opaque pixels, whitens transparent ones and blends the rest", () => {
    const rgba = new Uint8ClampedArray([
      10, 20, 30, 255, 10, 20, 30, 0, 0, 0, 0, 128,
    ]);
    expect([...flattenOnWhite(rgba)]).toEqual([
      10, 20, 30, 255, 255, 255, 127, 127, 127,
    ]);
  });
});

describe("withAlpha", () => {
  it("replaces alpha with the mask and leaves the input untouched", () => {
    const rgba = new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]);
    expect([...withAlpha(rgba, new Uint8Array([0, 200]))]).toEqual([
      1, 2, 3, 0, 4, 5, 6, 200,
    ]);
    expect(rgba[3]).toBe(255);
  });
});

// 4×3 image; `a` marks opaque pixels.
const image = (rows: string[]): Uint8ClampedArray =>
  new Uint8ClampedArray(
    rows
      .join("")
      .split("")
      .flatMap((c, i) => [i, i, i, c === "a" ? 255 : 0]),
  );

describe("opaqueBounds", () => {
  it("finds the box around opaque pixels", () => {
    expect(opaqueBounds(image(["....", ".aa.", "..a."]), 4)).toEqual({
      x: 1,
      y: 1,
      width: 2,
      height: 2,
    });
  });

  it("is undefined for a fully transparent image", () => {
    expect(opaqueBounds(image(["....", "...."]), 4)).toBeUndefined();
  });
});

describe("cropRgba", () => {
  it("copies the pixels inside the bounds", () => {
    const cropped = cropRgba(image(["....", ".aa.", "..a."]), 4, {
      x: 1,
      y: 1,
      width: 2,
      height: 2,
    });
    // Red channel holds the source pixel index.
    expect([0, 4, 8, 12].map((i) => cropped[i])).toEqual([5, 6, 9, 10]);
  });
});

describe("imageFiles", () => {
  it("keeps images by type or extension and skips everything else", () => {
    const files = [
      { name: "IMG_1.jpg", type: "image/jpeg" },
      { name: "IMG_2.HEIC", type: "" },
      { name: "notes.pdf", type: "application/pdf" },
      { name: "Kuvat", type: "" },
    ];
    expect(imageFiles(files).map((f) => f.name)).toEqual([
      "IMG_1.jpg",
      "IMG_2.HEIC",
    ]);
  });
});
