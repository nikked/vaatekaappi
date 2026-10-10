export type Slot = "top" | "bottom" | "dress" | "outer";

// Leaf categories of the user's tree. `null` = stored but not used in outfits yet.
export const CATEGORIES = {
  "Yläosa > Pitkähihaiset > Kauluspaidat": "top",
  "Yläosa > Pitkähihaiset > Neulepaidat": "top",
  "Yläosa > Lyhythihaiset > Kauluspaidat": "top",
  "Yläosa > Lyhythihaiset > T-paidat": "top",
  "Alaosa > Housut": "bottom",
  "Alaosa > Hameet > Pitkät hameet": "bottom",
  "Alaosa > Hameet > Lyhyet hameet": "bottom",
  "Alaosa > Shortsit": "bottom",
  Mekot: "dress",
  // Päällysosat are worn over a top, never alone; an outfit has one of them or a coat.
  "Päällysosat > Sisätakit": "outer",
  "Päällysosat > Bleiserit": "outer",
  "Päällysosat > Neuletakit": "outer",
  Takit: "outer",
  Sukat: null,
  "Kengät > Sandaalit": null,
  "Kengät > Lenkkarit": null,
  "Kengät > Korkkarit": null,
  "Päähineet > Lippikset": null,
  Korut: null,
  Asusteet: null,
  Alusvaatteet: null,
} as const satisfies Record<string, Slot | null>;

export const DEFAULT_CATEGORY: keyof typeof CATEGORIES = "Yläosa > Lyhythihaiset > T-paidat";

export const PATTERNS = ["solid", "patterned"] as const;
export const OCCASIONS = ["everyday", "party"] as const;
// How warm the garment is to wear, not its color temperature.
export const WARMTHS = ["warm", "cool"] as const;

export type Category = keyof typeof CATEGORIES;
export type Pattern = (typeof PATTERNS)[number];
export type Occasion = (typeof OCCASIONS)[number];
export type Warmth = (typeof WARMTHS)[number];

export type Rgb = readonly [number, number, number];

export type Garment = {
  id: string;
  name: string;
  description: string;
  image: Blob;
  cutout: Blob; // PNG with the background removed
  embedding: number[]; // SigLIP image embedding of the cut-out, normalized
  category: Category;
  colors: Rgb[];
  pattern: Pattern;
  occasions: Occasion[];
  warmth?: Warmth;
  bikeable: boolean;
  favourite: boolean;
};

// As stored or imported before the models have added the cut-out and embedding.
export type MaybeProcessedGarment = Omit<Garment, "cutout" | "embedding"> &
  Partial<Pick<Garment, "cutout" | "embedding">>;

// Old paths of categories that have moved, for garments saved or exported before.
const MOVED_CATEGORIES: Readonly<Record<string, Category>> = {
  "Takit > Sisätakit": "Päällysosat > Sisätakit",
  "Yläosa > Pitkähihaiset > Bleiserit": "Päällysosat > Bleiserit",
  "Yläosa > Pitkähihaiset > Neuletakit": "Päällysosat > Neuletakit",
};

export const currentCategory = (value: unknown): unknown =>
  typeof value === "string" ? (MOVED_CATEGORIES[value] ?? value) : value;

export const isProcessed = (g: MaybeProcessedGarment): g is Garment =>
  g.cutout !== undefined && g.embedding !== undefined;

export const isCategory = (value: unknown): value is Category =>
  typeof value === "string" && Object.hasOwn(CATEGORIES, value);

export const isOneOf =
  <T extends string>(values: readonly T[]) =>
  (value: unknown): value is T =>
    values.some((v) => v === value);
