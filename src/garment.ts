export type Slot = "top" | "bottom" | "dress" | "shoes" | "outer";

// Placeholder values until the real category list arrives; swap them here.
export const CATEGORIES = {
  "t-shirt": "top",
  shirt: "top",
  sweater: "top",
  trousers: "bottom",
  skirt: "bottom",
  dress: "dress",
  shoes: "shoes",
  jacket: "outer",
} as const satisfies Record<string, Slot>;

export const DEFAULT_CATEGORY: keyof typeof CATEGORIES = "t-shirt";

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export const FORMALITIES = ["casual", "smart", "formal"] as const;
export const PATTERNS = ["solid", "striped", "checked", "printed"] as const;

export type Category = keyof typeof CATEGORIES;
export type Season = (typeof SEASONS)[number];
export type Formality = (typeof FORMALITIES)[number];
export type Pattern = (typeof PATTERNS)[number];

export type Rgb = readonly [number, number, number];

export type Garment = {
  id: string;
  image: Blob;
  category: Category;
  colors: Rgb[];
  colorsUncertain: boolean;
  season: Season[];
  formality: Formality;
  pattern: Pattern;
};

export const isCategory = (value: unknown): value is Category =>
  typeof value === "string" && Object.hasOwn(CATEGORIES, value);

export const isOneOf =
  <T extends string>(values: readonly T[]) =>
  (value: unknown): value is T =>
    values.some((v) => v === value);
