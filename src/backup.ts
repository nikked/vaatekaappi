import {
  OCCASIONS,
  PATTERNS,
  WARMTHS,
  currentCategory,
  isCategory,
  isOneOf,
  type Garment,
  type MaybeProcessedGarment,
} from "./garment";
import { isProfile, isRgb, type Profile } from "./palette";

// Cut-out and embedding are optional so the hand-made example file imports;
// the app computes them on import.
type ExportedGarment = Omit<Garment, "image" | "cutout" | "embedding"> & {
  image: string;
  cutout?: string;
  embedding?: number[];
};

// `profile` is optional so files made before it existed still import.
type ExportFile = { version: 1; garments: ExportedGarment[]; profile?: Profile };

export type Backup = { garments: MaybeProcessedGarment[]; profile?: Profile };

const toDataUrl = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${blob.type};base64,${btoa(binary)}`;
};

const fromDataUrl = async (url: string): Promise<Blob> => (await fetch(url)).blob();

export const exportWardrobe = async (garments: readonly Garment[], profile: Profile): Promise<string> => {
  const file: ExportFile = {
    version: 1,
    profile,
    garments: await Promise.all(
      garments.map(async (g) => ({
        ...g,
        image: await toDataUrl(g.image),
        cutout: await toDataUrl(g.cutout),
      })),
    ),
  };
  return JSON.stringify(file);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isExportedGarment = (value: unknown): value is ExportedGarment =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  typeof value.description === "string" &&
  typeof value.image === "string" &&
  value.image.startsWith("data:") &&
  (value.cutout === undefined || (typeof value.cutout === "string" && value.cutout.startsWith("data:"))) &&
  (value.embedding === undefined ||
    (Array.isArray(value.embedding) && value.embedding.every((x) => typeof x === "number"))) &&
  isCategory(value.category) &&
  Array.isArray(value.colors) &&
  value.colors.every(isRgb) &&
  isOneOf(PATTERNS)(value.pattern) &&
  Array.isArray(value.occasions) &&
  value.occasions.every(isOneOf(OCCASIONS)) &&
  (value.warmth === undefined || isOneOf(WARMTHS)(value.warmth)) &&
  typeof value.bikeable === "boolean" &&
  typeof value.favourite === "boolean";

// Throws on anything that isn't a valid export, so a bad file never replaces the wardrobe.
export const importWardrobe = async (json: string): Promise<Backup> => {
  const parsed: unknown = JSON.parse(json);
  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.garments)) {
    throw new Error("Not a wardrobe export file");
  }
  const migrated = parsed.garments.map((g) => (isRecord(g) ? { ...g, category: currentCategory(g.category) } : g));
  const invalid = migrated.findIndex((g) => !isExportedGarment(g));
  if (invalid !== -1) throw new Error(`Invalid garment at index ${invalid}`);
  const garments: ExportedGarment[] = migrated.filter(isExportedGarment);
  if (parsed.profile !== undefined && !isProfile(parsed.profile)) throw new Error("Invalid color profile");
  return {
    garments: await Promise.all(
      garments.map(async ({ cutout, ...g }) => ({
        ...g,
        image: await fromDataUrl(g.image),
        ...(cutout === undefined ? {} : { cutout: await fromDataUrl(cutout) }),
      })),
    ),
    ...(parsed.profile === undefined ? {} : { profile: parsed.profile }),
  };
};
