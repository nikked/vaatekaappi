export type Slot = "top" | "bottom" | "dress" | "outer";

// Ids are stored and never change; the Finnish path is only a label, so the
// tree can be renamed or reorganised without touching saved garments.
// `slot: null` = stored but not used in outfits yet.
export const CATEGORIES = {
  "top-long-shirt": {
    path: ["Yläosa", "Pitkähihaiset", "Kauluspaidat"],
    slot: "top",
  },
  "top-long-knit": {
    path: ["Yläosa", "Pitkähihaiset", "Neulepaidat"],
    slot: "top",
  },
  "top-short-shirt": {
    path: ["Yläosa", "Lyhythihaiset", "Kauluspaidat"],
    slot: "top",
  },
  "top-short-tee": {
    path: ["Yläosa", "Lyhythihaiset", "T-paidat"],
    slot: "top",
  },
  "bottom-trousers": { path: ["Alaosa", "Housut"], slot: "bottom" },
  "bottom-skirt-long": {
    path: ["Alaosa", "Hameet", "Pitkät hameet"],
    slot: "bottom",
  },
  "bottom-skirt-short": {
    path: ["Alaosa", "Hameet", "Lyhyet hameet"],
    slot: "bottom",
  },
  "bottom-shorts": { path: ["Alaosa", "Shortsit"], slot: "bottom" },
  dress: { path: ["Mekot"], slot: "dress" },
  // Päällysosat are worn over a top, never alone; an outfit has one of them or a coat.
  "layer-overshirt": { path: ["Päällysosat", "Sisätakit"], slot: "outer" },
  "layer-blazer": { path: ["Päällysosat", "Bleiserit"], slot: "outer" },
  "layer-cardigan": { path: ["Päällysosat", "Neuletakit"], slot: "outer" },
  coat: { path: ["Takit"], slot: "outer" },
  socks: { path: ["Sukat"], slot: null },
  "shoes-sandals": { path: ["Kengät", "Sandaalit"], slot: null },
  "shoes-sneakers": { path: ["Kengät", "Lenkkarit"], slot: null },
  "shoes-heels": { path: ["Kengät", "Korkkarit"], slot: null },
  "hat-cap": { path: ["Päähineet", "Lippikset"], slot: null },
  jewelry: { path: ["Korut"], slot: null },
  accessories: { path: ["Asusteet"], slot: null },
  underwear: { path: ["Alusvaatteet"], slot: null },
} as const satisfies Record<
  string,
  { path: readonly string[]; slot: Slot | null }
>;

export type Category = keyof typeof CATEGORIES;

export const DEFAULT_CATEGORY: Category = "top-short-tee";

export const PATTERNS = ["solid", "patterned"] as const;
export const OCCASIONS = ["everyday", "party"] as const;
// How warm the garment is to wear, not its color temperature.
export const WARMTHS = ["warm", "cool"] as const;

export type Pattern = (typeof PATTERNS)[number];
export type Occasion = (typeof OCCASIONS)[number];
export type Warmth = (typeof WARMTHS)[number];

export type Rgb = readonly [number, number, number];

// Bumped whenever the stored shape changes; migrate.ts upgrades older records.
export const GARMENT_SCHEMA = 2;

// What the user entered: kept forever and migrated on every schema change.
export type GarmentInput = {
  schema: typeof GARMENT_SCHEMA;
  id: string;
  image: Blob; // original photo, max 2048 px
  name: string;
  description: string;
  brand: string;
  material: string;
  notes: string; // fit and style
  category: Category;
  colors: Rgb[];
  pattern: Pattern;
  occasions: Occasion[];
  warmth?: Warmth;
  bikeable: boolean;
  favourite: boolean;
};

// Computed from the photo; recomputed whenever `derivedBy` differs from the current models.
export type Derived = {
  cutout: Blob; // PNG with the background removed, cropped to the garment
  embedding: number[]; // image embedding of the uncropped cut-out, normalized
  derivedBy: string;
};

export type StoredGarment = GarmentInput & Partial<Derived>;
export type Garment = GarmentInput & Derived;

export const isCategory = (value: unknown): value is Category =>
  typeof value === "string" && Object.hasOwn(CATEGORIES, value);

export const categoryLabel = (category: Category): string =>
  CATEGORIES[category].path.join(" › ");
export const categoryLeaf = (category: Category): string =>
  CATEGORIES[category].path.at(-1) ?? category;
export const categoryGroup = (category: Category): string =>
  CATEGORIES[category].path[0];

export const isOneOf =
  <T extends string>(values: readonly T[]) =>
  (value: unknown): value is T =>
    values.some((v) => v === value);
