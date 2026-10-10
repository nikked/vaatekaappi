import type { StoredGarment } from "./garment";
import { isRecord, migrateGarment } from "./migrate";
import { isProfile, type Profile } from "./palette";

// The file is a container: `version` covers its own shape, while each garment
// carries its own `schema` and goes through migrateGarment. Photos and cut-outs
// are embedded as data URLs, so one file holds everything the user entered.
// `profile` is optional because files made before it existed still import.
type ExportFile = { version: 1; garments: Record<string, unknown>[]; profile?: Profile };

export type Backup = { garments: StoredGarment[]; profile?: Profile };

const toDataUrl = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${blob.type};base64,${btoa(binary)}`;
};

const fromDataUrl = async (value: unknown): Promise<unknown> =>
  typeof value === "string" && value.startsWith("data:") ? (await fetch(value)).blob() : value;

export const exportWardrobe = async (garments: readonly StoredGarment[], profile: Profile): Promise<string> => {
  const file: ExportFile = {
    version: 1,
    profile,
    garments: await Promise.all(
      garments.map(async ({ image, cutout, ...g }) => ({
        ...g,
        image: await toDataUrl(image),
        ...(cutout ? { cutout: await toDataUrl(cutout) } : {}),
      })),
    ),
  };
  return JSON.stringify(file);
};

// Throws on anything that isn't a valid export, so a bad file never replaces the wardrobe.
export const importWardrobe = async (json: string): Promise<Backup> => {
  const parsed: unknown = JSON.parse(json);
  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.garments)) {
    throw new Error("Not a wardrobe export file");
  }
  if (parsed.profile !== undefined && !isProfile(parsed.profile)) throw new Error("Invalid color profile");
  const garments = await Promise.all(
    parsed.garments.map(async (raw: unknown, i) => {
      const withBlobs = isRecord(raw)
        ? { ...raw, image: await fromDataUrl(raw.image), cutout: await fromDataUrl(raw.cutout) }
        : raw;
      try {
        return migrateGarment(withBlobs);
      } catch (e) {
        throw new Error(`Invalid garment at index ${i}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }),
  );
  return { garments, ...(parsed.profile === undefined ? {} : { profile: parsed.profile }) };
};
