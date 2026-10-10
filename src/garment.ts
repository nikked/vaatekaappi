export type Slot = "top" | "bottom" | "dress" | "outer";

// Leaf categories of the user's tree. `null` = stored but not used in outfits yet.
export const CATEGORIES = {
  "Yläosa > Pitkähihaiset > Kauluspaidat": "top",
  "Yläosa > Pitkähihaiset > Neulepaidat": "top",
  "Yläosa > Pitkähihaiset > Neuletakit": "top",
  // Worn over a top, never alone.
  "Yläosa > Pitkähihaiset > Bleiserit": "outer",
  "Yläosa > Lyhythihaiset > Kauluspaidat": "top",
  "Yläosa > Lyhythihaiset > T-paidat": "top",
  "Alaosa > Housut": "bottom",
  "Alaosa > Hameet > Pitkät hameet": "bottom",
  "Alaosa > Hameet > Lyhyet hameet": "bottom",
  "Alaosa > Shortsit": "bottom",
  Mekot: "dress",
  Takit: "outer",
  "Takit > Sisätakit": "outer",
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

export const isCategory = (value: unknown): value is Category =>
  typeof value === "string" && Object.hasOwn(CATEGORIES, value);

export const isOneOf =
  <T extends string>(values: readonly T[]) =>
  (value: unknown): value is T =>
    values.some((v) => v === value);
