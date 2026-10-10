import { describe, expect, it } from "vitest";
import { flattenOnWhite, withAlpha } from "./image";

describe("flattenOnWhite", () => {
  it("keeps opaque pixels, whitens transparent ones and blends the rest", () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 255, 10, 20, 30, 0, 0, 0, 0, 128]);
    expect([...flattenOnWhite(rgba)]).toEqual([10, 20, 30, 255, 255, 255, 127, 127, 127]);
  });
});

describe("withAlpha", () => {
  it("replaces alpha with the mask and leaves the input untouched", () => {
    const rgba = new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]);
    expect([...withAlpha(rgba, new Uint8Array([0, 200]))]).toEqual([1, 2, 3, 0, 4, 5, 6, 200]);
    expect(rgba[3]).toBe(255);
  });
});
