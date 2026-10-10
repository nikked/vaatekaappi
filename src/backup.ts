import {
  OCCASIONS,
  PATTERNS,
  WARMTHS,
  isCategory,
  isOneOf,
  type Garment,
  type Rgb,
} from "./garment";

type ExportedGarment = Omit<Garment, "image"> & { image: string };
type ExportFile = { version: 1; garments: ExportedGarment[] };

const toDataUrl = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${blob.type};base64,${btoa(binary)}`;
};

const fromDataUrl = async (url: string): Promise<Blob> => (await fetch(url)).blob();

export const exportWardrobe = async (garments: readonly Garment[]): Promise<string> => {
  const file: ExportFile = {
    version: 1,
    garments: await Promise.all(
      garments.map(async (g) => ({ ...g, image: await toDataUrl(g.image) })),
    ),
  };
  return JSON.stringify(file);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isRgb = (value: unknown): value is Rgb =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every((c) => typeof c === "number" && c >= 0 && c <= 255);

const isExportedGarment = (value: unknown): value is ExportedGarment =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  typeof value.description === "string" &&
  typeof value.image === "string" &&
  value.image.startsWith("data:") &&
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
export const importWardrobe = async (json: string): Promise<Garment[]> => {
  const parsed: unknown = JSON.parse(json);
  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.garments)) {
    throw new Error("Not a wardrobe export file");
  }
  const invalid = parsed.garments.findIndex((g) => !isExportedGarment(g));
  if (invalid !== -1) throw new Error(`Invalid garment at index ${invalid}`);
  const garments: ExportedGarment[] = parsed.garments.filter(isExportedGarment);
  return Promise.all(garments.map(async (g) => ({ ...g, image: await fromDataUrl(g.image) })));
};
