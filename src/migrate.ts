import {
  type Category,
  type Derived,
  GARMENT_SCHEMA,
  isCategory,
  isOneOf,
  OCCASIONS,
  PATTERNS,
  type StoredGarment,
  WARMTHS,
} from "./garment";
import { isRgb } from "./palette";

// Every shape a garment has ever been stored in must keep migrating here, and
// src/fixtures/ keeps a backup file per shape that the tests import. Never
// delete a step or a fixture: the user enters her clothes once.

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// Schema 1 stored the Finnish path, including paths that moved before schema 2.
const V1_CATEGORIES: Readonly<Record<string, Category>> = {
  "Yläosa > Pitkähihaiset > Kauluspaidat": "top-long-shirt",
  "Yläosa > Pitkähihaiset > Neulepaidat": "top-long-knit",
  "Yläosa > Pitkähihaiset > Neuletakit": "layer-cardigan",
  "Yläosa > Pitkähihaiset > Bleiserit": "layer-blazer",
  "Yläosa > Lyhythihaiset > Kauluspaidat": "top-short-shirt",
  "Yläosa > Lyhythihaiset > T-paidat": "top-short-tee",
  "Alaosa > Housut": "bottom-trousers",
  "Alaosa > Hameet > Pitkät hameet": "bottom-skirt-long",
  "Alaosa > Hameet > Lyhyet hameet": "bottom-skirt-short",
  "Alaosa > Shortsit": "bottom-shorts",
  Mekot: "dress",
  "Takit > Sisätakit": "layer-overshirt",
  "Päällysosat > Sisätakit": "layer-overshirt",
  "Päällysosat > Bleiserit": "layer-blazer",
  "Päällysosat > Neuletakit": "layer-cardigan",
  Takit: "coat",
  Sukat: "socks",
  "Kengät > Sandaalit": "shoes-sandals",
  "Kengät > Lenkkarit": "shoes-sneakers",
  "Kengät > Korkkarit": "shoes-heels",
  "Päähineet > Lippikset": "hat-cap",
  Korut: "jewelry",
  Asusteet: "accessories",
  Alusvaatteet: "underwear",
};

// Schema 1 had no brand, material or notes, and didn't record which models made
// the cut-out and embedding, so those are dropped and recomputed.
const fromV1 = ({
  cutout: _,
  embedding: __,
  ...v1
}: Record<string, unknown>): Record<string, unknown> => ({
  ...v1,
  schema: 2,
  category:
    typeof v1.category === "string"
      ? (V1_CATEGORIES[v1.category] ?? v1.category)
      : v1.category,
  brand: "",
  material: "",
  notes: "",
});

// Schema 2 had `bikeable`, true only for garments tagged as fine for biking.
// Schema 3 flips the default: untagged means fine, so everything starts that way.
const fromV2 = ({
  bikeable: _,
  ...v2
}: Record<string, unknown>): Record<string, unknown> => ({
  ...v2,
  schema: 3,
  noBiking: false,
});

const fail = (field: string): never => {
  throw new Error(`Invalid garment field: ${field}`);
};

const string = (r: Record<string, unknown>, field: string): string =>
  typeof r[field] === "string" ? r[field] : fail(field);

const boolean = (r: Record<string, unknown>, field: string): boolean =>
  typeof r[field] === "boolean" ? r[field] : fail(field);

const derived = (r: Record<string, unknown>): Derived | undefined => {
  const { cutout, embedding, derivedBy } = r;
  return cutout instanceof Blob &&
    typeof derivedBy === "string" &&
    Array.isArray(embedding) &&
    embedding.every((x) => typeof x === "number")
    ? { cutout, embedding, derivedBy }
    : undefined;
};

// Builds the record field by field, so unknown or stale fields never survive.
const parseCurrent = (r: Record<string, unknown>): StoredGarment => {
  const { image, category, colors, pattern, occasions, warmth } = r;
  return {
    schema: GARMENT_SCHEMA,
    id: string(r, "id"),
    image: image instanceof Blob ? image : fail("image"),
    name: string(r, "name"),
    description: string(r, "description"),
    brand: string(r, "brand"),
    material: string(r, "material"),
    notes: string(r, "notes"),
    category: isCategory(category) ? category : fail("category"),
    colors:
      Array.isArray(colors) && colors.every(isRgb) ? colors : fail("colors"),
    pattern: isOneOf(PATTERNS)(pattern) ? pattern : fail("pattern"),
    occasions:
      Array.isArray(occasions) && occasions.every(isOneOf(OCCASIONS))
        ? occasions
        : fail("occasions"),
    ...(warmth === undefined
      ? {}
      : { warmth: isOneOf(WARMTHS)(warmth) ? warmth : fail("warmth") }),
    noBiking: boolean(r, "noBiking"),
    favourite: boolean(r, "favourite"),
    ...derived(r),
  };
};

/** Any stored or exported garment, of any schema, in the current shape. Throws if it can't be read. */
export const migrateGarment = (raw: unknown): StoredGarment => {
  if (!isRecord(raw)) return fail("garment");
  if (raw.schema === undefined) return parseCurrent(fromV2(fromV1(raw)));
  if (raw.schema === 2) return parseCurrent(fromV2(raw));
  if (raw.schema === GARMENT_SCHEMA) return parseCurrent(raw);
  return fail("schema");
};
