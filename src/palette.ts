import { hexToRgb } from "./color";
import { isOneOf, type Rgb } from "./garment";

export const SEASON_TYPES = [
  "light-spring",
  "warm-spring",
  "clear-spring",
  "light-summer",
  "cool-summer",
  "soft-summer",
  "soft-autumn",
  "warm-autumn",
  "deep-autumn",
  "deep-winter",
  "cool-winter",
  "clear-winter",
] as const;

export type SeasonType = (typeof SEASON_TYPES)[number];

export const SEASON_LABELS: Record<SeasonType, string> = {
  "light-spring": "Vaalea kevät",
  "warm-spring": "Lämmin kevät",
  "clear-spring": "Kirkas kevät",
  "light-summer": "Vaalea kesä",
  "cool-summer": "Viileä kesä",
  "soft-summer": "Pehmeä kesä",
  "soft-autumn": "Pehmeä syksy",
  "warm-autumn": "Lämmin syksy",
  "deep-autumn": "Syvä syksy",
  "deep-winter": "Syvä talvi",
  "cool-winter": "Viileä talvi",
  "clear-winter": "Kirkas talvi",
};

// Approximation of commonly published warm autumn palettes; adjust against the real swatch card.
export const WARM_AUTUMN: readonly Rgb[] = [
  [183, 65, 14], // rust
  [204, 85, 0], // burnt orange
  [226, 114, 91], // terracotta
  [203, 65, 51], // tomato red
  [225, 173, 1], // mustard
  [205, 149, 12], // warm gold
  [128, 128, 0], // olive
  [138, 154, 91], // moss
  [1, 68, 33], // forest green
  [0, 128, 128], // teal
  [193, 154, 107], // camel
  [123, 63, 0], // chocolate brown
  [72, 50, 34], // dark brown
  [205, 127, 50], // bronze
  [255, 253, 208], // cream
  [240, 220, 180], // warm beige
];

const fromHex = (hexes: readonly string[]): Rgb[] =>
  hexes.map(hexToRgb).filter((rgb): rgb is Rgb => rgb !== undefined);

// Starting points only, approximating commonly published palettes; the user edits them.
export const SEASON_PALETTES: Record<SeasonType, readonly Rgb[]> = {
  "light-spring": fromHex([
    "#fff5d7",
    "#f9d5a7",
    "#ffb6a3",
    "#f7a35c",
    "#f4e285",
    "#b8e08c",
    "#8fd5c3",
    "#9fd3f0",
    "#c9a0dc",
    "#e8c79a",
    "#f28e8e",
    "#6fb7c9",
  ]),
  "warm-spring": fromHex([
    "#fff0c8",
    "#ffa45b",
    "#ff7f50",
    "#f5b400",
    "#f28c28",
    "#c49a6c",
    "#8db600",
    "#3eb489",
    "#40e0d0",
    "#e9967a",
    "#8b5a2b",
    "#e2725b",
  ]),
  "clear-spring": fromHex([
    "#fffff0",
    "#ff6f61",
    "#ffd700",
    "#00a86b",
    "#32cd32",
    "#00ced1",
    "#1e90ff",
    "#ff69b4",
    "#7b68ee",
    "#000080",
    "#ff8c00",
    "#ff4f4f",
  ]),
  "light-summer": fromHex([
    "#f8f8ff",
    "#e6e6fa",
    "#b0c4de",
    "#add8e6",
    "#98d8c8",
    "#f4c2c2",
    "#e8a0bf",
    "#c3b1e1",
    "#a7c7e7",
    "#d3d3d3",
    "#7fa7c7",
    "#9fbfaa",
  ]),
  "cool-summer": fromHex([
    "#f5f5f5",
    "#4682b4",
    "#5f9ea0",
    "#6a5acd",
    "#db7093",
    "#b03060",
    "#8e4585",
    "#708090",
    "#2f4f7f",
    "#48a9a6",
    "#e0b0ff",
    "#36454f",
  ]),
  "soft-summer": fromHex([
    "#ede6db",
    "#a9a9a9",
    "#8ba8b7",
    "#779ecb",
    "#8fbc8f",
    "#b5838d",
    "#c08081",
    "#996888",
    "#6e7f80",
    "#5d7b93",
    "#a39193",
    "#4f5d75",
  ]),
  "soft-autumn": fromHex([
    "#f0e6d2",
    "#c19a6b",
    "#a67b5b",
    "#8a9a5b",
    "#6b8e23",
    "#cd9575",
    "#b87333",
    "#e2a76f",
    "#9e8f6b",
    "#5f8575",
    "#a0522d",
    "#d8b4a0",
  ]),
  "warm-autumn": WARM_AUTUMN,
  "deep-autumn": fromHex([
    "#3b2f2f",
    "#800020",
    "#8b0000",
    "#b7410e",
    "#cc5500",
    "#daa520",
    "#556b2f",
    "#013220",
    "#014d4e",
    "#4b2840",
    "#8b4513",
    "#f5deb3",
  ]),
  "deep-winter": fromHex([
    "#000000",
    "#ffffff",
    "#800000",
    "#dc143c",
    "#4b0082",
    "#00008b",
    "#006400",
    "#008080",
    "#36454f",
    "#c71585",
    "#4169e1",
    "#e0115f",
  ]),
  "cool-winter": fromHex([
    "#ffffff",
    "#000000",
    "#e0218a",
    "#0047ab",
    "#4169e1",
    "#8a2be2",
    "#00a693",
    "#c0c0c0",
    "#b0e0e6",
    "#f0f8ff",
    "#9b111e",
    "#2c3e50",
  ]),
  "clear-winter": fromHex([
    "#ffffff",
    "#000000",
    "#ff0000",
    "#ff1493",
    "#0000ff",
    "#00b7eb",
    "#50c878",
    "#ffff66",
    "#7f00ff",
    "#000080",
    "#e6e6fa",
    "#ff00ff",
  ]),
};

export type Profile = { season: SeasonType; palette: Rgb[] };

export const profileFor = (season: SeasonType): Profile => ({
  season,
  palette: [...SEASON_PALETTES[season]],
});

export const DEFAULT_PROFILE: Profile = profileFor("warm-autumn");

export const isRgb = (value: unknown): value is Rgb =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every(
    (c) => typeof c === "number" && Number.isInteger(c) && c >= 0 && c <= 255,
  );

export const isProfile = (value: unknown): value is Profile =>
  typeof value === "object" &&
  value !== null &&
  "season" in value &&
  "palette" in value &&
  isOneOf(SEASON_TYPES)(value.season) &&
  Array.isArray(value.palette) &&
  value.palette.every(isRgb);
