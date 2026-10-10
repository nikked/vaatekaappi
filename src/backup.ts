import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { StoredGarment } from "./garment";
import { isRecord, migrateGarment } from "./migrate";
import { isProfile, type Profile } from "./palette";

// Two container formats, both kept importable forever. `version` covers the
// container; each garment carries its own `schema` and goes through migrateGarment.
//   1: one JSON file, photos as data URLs, `profile` optional (older files lack it).
//   2: a zip with vaatteet.json plus the photos and cut-outs as files.
const DATA_FILE = "vaatteet.json";

export type Backup = { garments: StoredGarment[]; profile?: Profile };

const fromDataUrl = async (value: unknown): Promise<unknown> =>
  typeof value === "string" && value.startsWith("data:") ? (await fetch(value)).blob() : value;

const migrateAll = (raws: readonly unknown[]): StoredGarment[] =>
  raws.map((raw, i) => {
    try {
      return migrateGarment(raw);
    } catch (e) {
      throw new Error(`Invalid garment at index ${i}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

const parseProfile = (value: unknown): { profile?: Profile } => {
  if (value === undefined) return {};
  if (!isProfile(value)) throw new Error("Invalid color profile");
  return { profile: value };
};

const importJson = async (json: string): Promise<Backup> => {
  const parsed: unknown = JSON.parse(json);
  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.garments)) {
    throw new Error("Not a wardrobe export file");
  }
  const garments = await Promise.all(
    parsed.garments.map(async (raw: unknown) =>
      isRecord(raw) ? { ...raw, image: await fromDataUrl(raw.image), cutout: await fromDataUrl(raw.cutout) } : raw,
    ),
  );
  return { garments: migrateAll(garments), ...parseProfile(parsed.profile) };
};

const EXTENSIONS: Readonly<Record<string, string>> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const mimeOf = (path: string): string =>
  Object.entries(EXTENSIONS).find(([, ext]) => path.endsWith(`.${ext}`))?.[0] ?? "application/octet-stream";

// Readable file names for someone browsing the zip without the app.
export const slug = (name: string): string =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const bytesOf = async (blob: Blob): Promise<Uint8Array> => new Uint8Array(await blob.arrayBuffer());

export const exportBackup = async (garments: readonly StoredGarment[], profile: Profile): Promise<Uint8Array> => {
  const entries = await Promise.all(
    garments.map(async ({ image, cutout, ...g }) => {
      const imagePath = `kuvat/${[slug(g.name), g.id].filter(Boolean).join("-")}.${EXTENSIONS[image.type] ?? "jpg"}`;
      const cutoutPath = `leikatut/${g.id}.png`;
      return {
        record: { ...g, image: imagePath, ...(cutout ? { cutout: cutoutPath } : {}) },
        // Photos are already compressed; storing them as-is keeps export fast.
        files: [
          [imagePath, [await bytesOf(image), { level: 0 }]] as const,
          ...(cutout ? [[cutoutPath, [await bytesOf(cutout), { level: 0 }]] as const] : []),
        ],
      };
    }),
  );
  const data = { version: 2, profile, garments: entries.map((e) => e.record) };
  return zipSync({
    [DATA_FILE]: strToU8(JSON.stringify(data, null, 2)),
    ...Object.fromEntries(entries.flatMap((e) => e.files)),
  });
};

const importZip = (bytes: Uint8Array): Backup => {
  const entries = unzipSync(bytes);
  // Finder wraps a re-zipped folder, so the data file may sit one level down.
  const dataPath = Object.keys(entries)
    .filter((p) => p === DATA_FILE || p.endsWith(`/${DATA_FILE}`))
    .sort((a, b) => a.length - b.length)[0];
  const dataBytes = dataPath === undefined ? undefined : entries[dataPath];
  if (dataPath === undefined || dataBytes === undefined) throw new Error("Not a wardrobe export file");
  const root = dataPath.slice(0, -DATA_FILE.length);

  const parsed: unknown = JSON.parse(strFromU8(dataBytes));
  if (!isRecord(parsed) || parsed.version !== 2 || !Array.isArray(parsed.garments)) {
    throw new Error("Not a wardrobe export file");
  }
  const blobAt = (path: unknown): unknown => {
    const file = typeof path === "string" ? entries[root + path] : undefined;
    return typeof path === "string" && file ? new Blob([new Uint8Array(file)], { type: mimeOf(path) }) : path;
  };
  const garments = parsed.garments.map((raw: unknown) =>
    isRecord(raw) ? { ...raw, image: blobAt(raw.image), cutout: blobAt(raw.cutout) } : raw,
  );
  return { garments: migrateAll(garments), ...parseProfile(parsed.profile) };
};

const isZip = (bytes: Uint8Array): boolean => bytes[0] === 0x50 && bytes[1] === 0x4b;

/** Imports a zip backup or an older JSON one. Throws on anything else, so a bad file never replaces the wardrobe. */
export const importBackup = async (bytes: Uint8Array): Promise<Backup> =>
  isZip(bytes) ? importZip(bytes) : importJson(new TextDecoder().decode(bytes));
