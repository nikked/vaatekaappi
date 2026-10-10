import { deltaE, type Lab, rgbToLab } from "./color";
import {
  CATEGORIES,
  type Garment,
  type Occasion,
  type Rgb,
  type Slot,
} from "./garment";

type OutfitTemplate = {
  required: readonly Slot[];
  optional: readonly Slot[];
};

export type Outfit = {
  garmentIds: string[];
  score: number;
};

export type OutfitFilter = {
  occasion: Occasion;
  cycling: boolean;
};

type Lch = readonly [number, number, number];

export const TEMPLATES: readonly OutfitTemplate[] = [
  { required: ["top", "bottom"], optional: ["outer"] },
  { required: ["dress"], optional: ["outer"] },
];

// Lab chroma below this counts as neutral: greys, black, white, but also cream
// (~23), beige and dark brown, which are worn as neutrals. Camel and denim
// (~31) stay chromatic, so they are judged by hue like any other color.
export const NEUTRAL_CHROMA = 25;
// Wide enough that classic autumn pairs (rust + olive, ~55°) count as harmonious.
export const ANALOGOUS_MAX_DEGREES = 60;
export const COMPLEMENTARY_TOLERANCE_DEGREES = 20;
export const MAX_HUES = 2;
export const PAIR_BONUS = 1;
export const CLASH_PENALTY = 1;
export const EXTRA_HUE_PENALTY = 1;
// Harmony is a mean over pairs in [-1, 1]; at this weight a garment ΔE 20 from
// the palette (clearly off-palette) costs as much as one full clash.
export const PALETTE_WEIGHT = 1 / 20;

export const slotOf = (garment: Garment): Slot | null =>
  CATEGORIES[garment.category].slot;

const cartesian = <T>(choices: readonly (readonly T[])[]): T[][] =>
  choices.reduce<T[][]>(
    (combos, options) =>
      combos.flatMap((combo) => options.map((o) => [...combo, o])),
    [[]],
  );

export const generateOutfits = (garments: readonly Garment[]): Garment[][] =>
  TEMPLATES.flatMap(({ required, optional }) => {
    const inSlot = (slot: Slot): (Garment | null)[] =>
      garments.filter((g) => slotOf(g) === slot);
    const choices = [
      ...required.map(inSlot),
      ...optional.map((slot) => [null, ...inSlot(slot)]),
    ];
    return cartesian(choices).map((combo) => combo.filter((g) => g !== null));
  });

export const fitsFilter = (
  garment: Garment,
  { occasion, cycling }: OutfitFilter,
): boolean =>
  garment.occasions.includes(occasion) &&
  (!cycling || slotOf(garment) !== "bottom" || garment.bikeable);

export const hasAtMostOnePattern = (outfit: readonly Garment[]): boolean =>
  outfit.filter((g) => g.pattern !== "solid").length <= 1;

const dominantColors = (outfit: readonly Garment[]): Rgb[] =>
  outfit.flatMap((g) => g.colors.slice(0, 1));

export const labToLch = ([l, a, b]: Lab): Lch => [
  l,
  Math.hypot(a, b),
  ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
];

export const hueDistance = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;

// The worst-fitting garment, not the mean: with a mean, adding any on-palette
// layer would lift the score and that layer would end up in every outfit.
export const paletteDistance = (
  outfit: readonly Garment[],
  palette: readonly Rgb[],
): number => {
  const paletteLabs = palette.map(rgbToLab);
  return Math.max(
    0,
    ...dominantColors(outfit).map((color) => {
      const lab = rgbToLab(color);
      return Math.min(...paletteLabs.map((p) => deltaE(lab, p)));
    }),
  );
};

export const pairScore = (hueA: number, hueB: number): number => {
  const d = hueDistance(hueA, hueB);
  if (d <= ANALOGOUS_MAX_DEGREES) return PAIR_BONUS;
  if (Math.abs(d - 180) <= COMPLEMENTARY_TOLERANCE_DEGREES) return PAIR_BONUS;
  return -CLASH_PENALTY;
};

// Groups hues within the analogous range, so two rust garments count as one hue.
const distinctHueCount = (hues: readonly number[]): number =>
  hues.reduce<number[]>(
    (groups, hue) =>
      groups.some((g) => hueDistance(g, hue) <= ANALOGOUS_MAX_DEGREES)
        ? groups
        : // biome-ignore lint/performance/noAccumulatingSpread: an outfit has at most four hues; kept immutable
          [...groups, hue],
    [],
  ).length;

// With no color pairs (one color + neutrals) the outfit gets the same score as
// a good pair, so adding a matching layer is neither rewarded nor punished.
export const colorHarmony = (outfit: readonly Garment[]): number => {
  const hues = dominantColors(outfit)
    .map((color) => labToLch(rgbToLab(color)))
    .filter(([, chroma]) => chroma >= NEUTRAL_CHROMA)
    .map(([, , hue]) => hue);
  const pairs = hues.flatMap((a, i) =>
    hues.slice(i + 1).map((b) => pairScore(a, b)),
  );
  const extraHues = Math.max(0, distinctHueCount(hues) - MAX_HUES);
  return (
    (pairs.length === 0 ? PAIR_BONUS : mean(pairs)) -
    extraHues * EXTRA_HUE_PENALTY
  );
};

export const scoreOutfit = (
  outfit: readonly Garment[],
  palette: readonly Rgb[],
): number =>
  colorHarmony(outfit) - PALETTE_WEIGHT * paletteDistance(outfit, palette);

export const rankOutfits = (
  garments: readonly Garment[],
  filter: OutfitFilter,
  palette: readonly Rgb[],
): Outfit[] =>
  generateOutfits(garments.filter((g) => fitsFilter(g, filter)))
    .filter(hasAtMostOnePattern)
    .map((outfit) => ({
      garmentIds: outfit.map((g) => g.id),
      score: scoreOutfit(outfit, palette),
    }))
    .sort((a, b) => b.score - a.score);

// Replaces the garment in `slot`, adds one to an empty slot, or with
// `undefined` removes it. Used when the user swaps a single garment.
export const withSlot = (
  outfit: readonly Garment[],
  slot: Slot,
  garment: Garment | undefined,
): Garment[] => [
  ...outfit.filter((g) => slotOf(g) !== slot),
  ...(garment ? [garment] : []),
];

export const SCORE_DOTS = 5;

// The difference between a harmonious pair and a clash. Outfits closer than
// this to the best one shouldn't look much worse just because the list is short.
export const MIN_SCORE_SPREAD = PAIR_BONUS + CLASH_PENALTY;

// Relative to the outfits on screen, since raw scores mean nothing to the user.
// Clamped because a swapped outfit can score outside the listed range.
export const scoreDots = (
  score: number,
  best: number,
  worst: number,
): number => {
  const floor = Math.min(worst, best - MIN_SCORE_SPREAD);
  const dots =
    1 + Math.round(((score - floor) / (best - floor)) * (SCORE_DOTS - 1));
  return Math.max(1, Math.min(SCORE_DOTS, dots));
};
