import { describe, expect, it } from "vitest";
import {
  deltaE,
  dominantColors,
  estimateBackground,
  extractColors,
  rgbToLab,
  type Pixels,
} from "./color";
import type { Rgb } from "./garment";

// Background-colored image with a centered rectangle of `fill`.
const image = (
  width: number,
  height: number,
  background: Rgb,
  fill: (x: number, y: number) => Rgb | null,
): Pixels => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fill(x, y) ?? background;
      data.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  return { data, width, height };
};

const inside = (x: number, y: number, size: number, margin: number) =>
  x >= margin && x < size - margin && y >= margin && y < size - margin;

describe("rgbToLab", () => {
  it("maps white and black to L 100 and 0", () => {
    expect(rgbToLab([255, 255, 255])[0]).toBeCloseTo(100, 1);
    expect(rgbToLab([0, 0, 0])[0]).toBeCloseTo(0, 1);
  });

  it("matches the reference value for pure red", () => {
    const [l, a, b] = rgbToLab([255, 0, 0]);
    expect(l).toBeCloseTo(53.24, 1);
    expect(a).toBeCloseTo(80.09, 0);
    expect(b).toBeCloseTo(67.2, 0);
  });
});

describe("deltaE", () => {
  it("is zero for identical colors and large for black vs white", () => {
    expect(deltaE(rgbToLab([10, 20, 30]), rgbToLab([10, 20, 30]))).toBe(0);
    expect(deltaE(rgbToLab([0, 0, 0]), rgbToLab([255, 255, 255]))).toBeCloseTo(100, 0);
  });
});

describe("estimateBackground", () => {
  it("ignores a garment touching one edge", () => {
    const pixels = image(10, 10, [240, 240, 240], (x) => (x < 3 ? [20, 20, 120] : null));
    expect(estimateBackground(pixels)).toEqual([240, 240, 240]);
  });
});

describe("dominantColors", () => {
  it("orders clusters by size", () => {
    const red: Rgb = [200, 30, 30];
    const blue: Rgb = [30, 30, 200];
    const points = [...Array<Rgb>(30).fill(blue), ...Array<Rgb>(70).fill(red)];
    expect(dominantColors(points, 2)).toEqual([red, blue]);
  });

  it("returns fewer colors than k when the input has fewer distinct colors", () => {
    expect(dominantColors(Array<Rgb>(10).fill([1, 2, 3]), 3)).toEqual([[1, 2, 3]]);
  });

  it("averages near-identical shades into one color", () => {
    const shades: Rgb[] = [[100, 50, 20], [102, 52, 22], [98, 48, 18]];
    const points = [...shades, ...Array<Rgb>(3).fill([20, 120, 20])];
    expect(dominantColors(points, 2)).toContainEqual([100, 50, 20]);
  });
});

describe("extractColors", () => {
  it("finds the garment colors and ignores the background", () => {
    const size = 40;
    const pixels = image(size, size, [245, 245, 245], (x, y) =>
      inside(x, y, size, 5) ? (x < 20 ? [150, 75, 30] : [40, 60, 30]) : null,
    );
    const { colors, uncertain } = extractColors(pixels, 2);
    expect(uncertain).toBe(false);
    expect(colors).toHaveLength(2);
    expect(colors).toContainEqual([150, 75, 30]);
    expect(colors).toContainEqual([40, 60, 30]);
  });

  it("ignores the thin blended edge that downscaling leaves around a garment", () => {
    const size = 100;
    const pixels = image(size, size, [245, 245, 245], (x, y) => {
      if (!inside(x, y, size, 10)) return null;
      return inside(x, y, size, 11) ? [150, 75, 30] : [200, 160, 138];
    });
    expect(extractColors(pixels).colors).toEqual([[150, 75, 30]]);
  });

  it("flags a garment that matches the background as uncertain", () => {
    const size = 20;
    const pixels = image(size, size, [245, 245, 245], (x, y) =>
      inside(x, y, size, 3) ? [243, 244, 245] : null,
    );
    expect(extractColors(pixels)).toEqual({ colors: [], uncertain: true });
  });
});
