import { describe, expect, it } from "vitest";
import {
  cutoutColors,
  deltaE,
  dominantColors,
  hexToRgb,
  mergeSimilar,
  opaquePixels,
  type Pixels,
  rgbToHex,
  rgbToLab,
} from "./color";
import type { Rgb } from "./garment";

// Transparent image with an opaque garment drawn by `fill`.
const cutout = (
  size: number,
  fill: (x: number, y: number) => [number, number, number, number] | null,
): Pixels => {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      data.set(fill(x, y) ?? [0, 0, 0, 0], (y * size + x) * 4);
    }
  }
  return { data, width: size, height: size };
};

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
    expect(deltaE(rgbToLab([0, 0, 0]), rgbToLab([255, 255, 255]))).toBeCloseTo(
      100,
      0,
    );
  });
});

describe("opaquePixels", () => {
  it("keeps opaque pixels and drops transparent and half-transparent edge pixels", () => {
    const pixels = cutout(3, (x) =>
      x === 0 ? [10, 20, 30, 255] : x === 1 ? [200, 200, 200, 120] : null,
    );
    expect(opaquePixels(pixels)).toEqual(Array<Rgb>(3).fill([10, 20, 30]));
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
    expect(dominantColors(Array<Rgb>(10).fill([1, 2, 3]), 3)).toEqual([
      [1, 2, 3],
    ]);
  });

  it("averages near-identical shades into one color", () => {
    const shades: Rgb[] = [
      [100, 50, 20],
      [102, 52, 22],
      [98, 48, 18],
    ];
    const points = [...shades, ...Array<Rgb>(3).fill([20, 120, 20])];
    expect(dominantColors(points, 2)).toContainEqual([100, 50, 20]);
  });
});

describe("mergeSimilar", () => {
  it("merges shades of one color into the first (largest) one", () => {
    const light: Rgb = [120, 63, 105];
    const shadow: Rgb = [86, 36, 74];
    expect(mergeSimilar([light, shadow], 18)).toEqual([light]);
  });

  it("keeps clearly different colors", () => {
    expect(
      mergeSimilar(
        [
          [255, 153, 0],
          [8, 145, 145],
        ],
        18,
      ),
    ).toEqual([
      [255, 153, 0],
      [8, 145, 145],
    ]);
  });
});

describe("cutoutColors", () => {
  it("suggests one color for a solid garment lit unevenly", () => {
    const pixels = cutout(20, (x, y) =>
      y < 10 ? [120, 63, 105, 255] : x < 15 ? [104, 50, 90, 255] : null,
    );
    expect(cutoutColors(pixels)).toHaveLength(1);
  });

  it("suggests both colors of a two-colored garment, largest first", () => {
    const pixels = cutout(20, (_, y) =>
      y < 13 ? [150, 75, 30, 255] : [40, 60, 30, 255],
    );
    expect(cutoutColors(pixels)).toEqual([
      [150, 75, 30],
      [40, 60, 30],
    ]);
  });

  it("suggests nothing for an empty cut-out", () => {
    expect(cutoutColors(cutout(5, () => null))).toEqual([]);
  });
});

describe("hex conversion", () => {
  it("round-trips through hex", () => {
    expect(rgbToHex([204, 153, 255])).toBe("#cc99ff");
    expect(hexToRgb("#CC99FF")).toEqual([204, 153, 255]);
    expect(hexToRgb(rgbToHex([0, 8, 255]))).toEqual([0, 8, 255]);
  });

  it("rejects malformed hex like the double hash in the source data", () => {
    expect(hexToRgb("##cc99ff")).toBeUndefined();
    expect(hexToRgb("#fff")).toBeUndefined();
  });
});
