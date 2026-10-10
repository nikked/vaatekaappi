import type { Rgb } from "./garment";

export type Lab = readonly [number, number, number];

const srgbToLinear = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const labF = (t: number): number =>
  t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;

// sRGB → CIELAB, D65 white point.
export const rgbToLab = ([r, g, b]: Rgb): Lab => {
  const [lr, lg, lb] = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  const x = (0.4124 * lr + 0.3576 * lg + 0.1805 * lb) / 0.95047;
  const y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  const z = (0.0193 * lr + 0.1192 * lg + 0.9505 * lb) / 1.08883;
  const [fx, fy, fz] = [labF(x), labF(y), labF(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};

export const deltaE = (a: Lab, b: Lab): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export type Pixels = {
  data: Uint8ClampedArray; // RGBA, as from ImageData
  width: number;
  height: number;
};

// Cut-outs fade out at the edges; half-transparent pixels are blends with nothing.
const MIN_ALPHA = 200;

export const opaquePixels = ({ data }: Pixels): Rgb[] => {
  const result: Rgb[] = [];
  for (let i = 0; i + 3 < data.length; i += 4) {
    if ((data[i + 3] ?? 0) >= MIN_ALPHA)
      result.push([data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]);
  }
  return result;
};

const mean = (points: readonly Rgb[]): Rgb => {
  const sum = points.reduce<[number, number, number]>(
    (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]],
    [0, 0, 0],
  );
  return [
    Math.round(sum[0] / points.length),
    Math.round(sum[1] / points.length),
    Math.round(sum[2] / points.length),
  ];
};

const nearest = (lab: Lab, centers: readonly Lab[]): number =>
  centers.reduce(
    (best, c, i) =>
      deltaE(lab, c) < deltaE(lab, centers[best] ?? c) ? i : best,
    0,
  );

// Farthest-point init keeps the result deterministic and testable.
const initialCenters = (labs: readonly Lab[], k: number): Lab[] => {
  const first = labs[0];
  if (!first) return [];
  const centers: Lab[] = [first];
  while (centers.length < k) {
    const distances = labs.map((l) =>
      Math.min(...centers.map((c) => deltaE(l, c))),
    );
    const farthest = distances.indexOf(Math.max(...distances));
    if ((distances[farthest] ?? 0) === 0) break;
    const next = labs[farthest];
    if (next) centers.push(next);
  }
  return centers;
};

// Clusters in Lab so distances match perceived difference; returns RGB means
// ordered by cluster size. Clusters under `minShare` are dropped: they are
// usually garment/background blends along the edge, not real garment colors.
export const dominantColors = (
  points: readonly Rgb[],
  k: number,
  minShare = 0.1,
  iterations = 10,
): Rgb[] => {
  const labs = points.map(rgbToLab);
  let centers = initialCenters(labs, k);
  let assignment = labs.map((l) => nearest(l, centers));
  for (let i = 0; i < iterations; i++) {
    centers = centers.map((c, ci) => {
      const members = labs.filter((_, pi) => assignment[pi] === ci);
      if (members.length === 0) return c;
      return [
        members.reduce((s, m) => s + m[0], 0) / members.length,
        members.reduce((s, m) => s + m[1], 0) / members.length,
        members.reduce((s, m) => s + m[2], 0) / members.length,
      ];
    });
    assignment = labs.map((l) => nearest(l, centers));
  }
  return centers
    .map((_, ci) => points.filter((_, pi) => assignment[pi] === ci))
    .filter(
      (members) =>
        members.length > 0 && members.length >= points.length * minShare,
    )
    .sort((a, b) => b.length - a.length)
    .map(mean);
};

// Light and shadow on the same fabric come out as separate clusters; closer
// than this they are suggested as one color.
const SAME_COLOR_DELTA_E = 18;

// Keeps the first (largest) of any colors closer than `maxDeltaE` to each other.
export const mergeSimilar = (
  colors: readonly Rgb[],
  maxDeltaE: number,
): Rgb[] =>
  colors.reduce<Rgb[]>(
    (kept, c) =>
      kept.some((k) => deltaE(rgbToLab(k), rgbToLab(c)) < maxDeltaE)
        ? kept
        : [...kept, c],
    [],
  );

export const cutoutColors = (pixels: Pixels, max = 2): Rgb[] =>
  mergeSimilar(
    dominantColors(opaquePixels(pixels), 3),
    SAME_COLOR_DELTA_E,
  ).slice(0, max);

export const rgbToHex = (rgb: Rgb): string =>
  `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;

export const hexToRgb = (hex: string): Rgb | undefined => {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!match) return undefined;
  const [, r = "", g = "", b = ""] = match;
  return [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16)];
};
