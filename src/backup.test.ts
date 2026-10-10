import { describe, expect, it } from "vitest";
import { strToU8, unzipSync, zipSync } from "fflate";
import { exportBackup, importBackup, slug } from "./backup";
import backupContainer2 from "./fixtures/backup-container2.zip.b64?raw";
import backupSchema1 from "./fixtures/backup-schema1.json?raw";
import type { Garment, StoredGarment } from "./garment";
import { DEFAULT_PROFILE, profileFor } from "./palette";

const garment = (id: string, bytes: number[]): Garment => ({
  schema: 2,
  id,
  image: new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }),
  name: "Liila neulepaita",
  description: "Lämmin pörröinen neulepaita",
  brand: "Arket",
  material: "villa",
  notes: "lyhyt malli",
  category: "top-long-knit",
  colors: [[204, 153, 255]],
  pattern: "solid",
  occasions: ["everyday", "party"],
  warmth: "warm",
  bikeable: false,
  favourite: true,
  cutout: new Blob([new Uint8Array([...bytes, 9])], { type: "image/png" }),
  embedding: [0.6, 0.8],
  derivedBy: "models-a",
});

const bytes = async (blob: Blob | undefined) => [...new Uint8Array((await blob?.arrayBuffer()) ?? new ArrayBuffer(0))];
const withoutBlobs = ({ image: _, cutout: __, ...rest }: StoredGarment) => rest;

const roundTrip = async (garments: readonly StoredGarment[], profile = DEFAULT_PROFILE) =>
  importBackup(await exportBackup(garments, profile));

describe("zip export → import", () => {
  it("round-trips every field, photo and cut-out", async () => {
    const original = [garment("a", [0, 1, 2, 255]), garment("b", [137, 80, 78, 71])];
    const { garments: restored } = await roundTrip(original);

    expect(restored.map(withoutBlobs)).toEqual(original.map(withoutBlobs));
    for (const [i, g] of restored.entries()) {
      expect(g.image.type).toBe("image/jpeg");
      expect(g.cutout?.type).toBe("image/png");
      expect(await bytes(g.image)).toEqual(await bytes(original[i]?.image));
      expect(await bytes(g.cutout)).toEqual(await bytes(original[i]?.cutout));
    }
  });

  it("round-trips a garment whose cut-out hasn't been made yet", async () => {
    const { cutout: _, embedding: __, derivedBy: ___, ...unprocessed } = garment("a", [1]);
    const { garments } = await roundTrip([unprocessed]);
    expect(garments.map(withoutBlobs)).toEqual([withoutBlobs(unprocessed)]);
  });

  it("round-trips an edited color profile", async () => {
    const profile = { ...profileFor("soft-summer"), palette: [[1, 2, 3] as const] };
    expect((await roundTrip([], profile)).profile).toEqual({ season: "soft-summer", palette: [[1, 2, 3]] });
  });

  it("lays the zip out readably: data file, named photos, cut-outs", async () => {
    const zip = unzipSync(await exportBackup([garment("a1", [1])], DEFAULT_PROFILE));
    expect(Object.keys(zip).sort()).toEqual(["kuvat/liila-neulepaita-a1.jpg", "leikatut/a1.png", "vaatteet.json"]);
  });

  it("still imports after the zip was unpacked and re-zipped into a folder by Finder", async () => {
    const zip = unzipSync(await exportBackup([garment("a", [1, 2])], DEFAULT_PROFILE));
    const rezipped = zipSync(Object.fromEntries(Object.entries(zip).map(([path, data]) => [`Kaappi/${path}`, data])));
    const { garments } = await importBackup(rezipped);
    expect(await bytes(garments[0]?.image)).toEqual([1, 2]);
  });
});

describe("slug", () => {
  it("makes ASCII file names from Finnish garment names", () => {
    expect(slug("Mustat leveälahkeiset housut")).toBe("mustat-levealahkeiset-housut");
    expect(slug("  Ö!  ")).toBe("o");
  });
});

// Backups made by earlier versions of the app must import forever.
describe("importing a schema 1 backup", () => {
  it("keeps everything the user entered", async () => {
    const { garments, profile } = await importBackup(strToU8(backupSchema1));

    expect(profile).toEqual({ season: "warm-autumn", palette: [[183, 65, 14], [0, 128, 128]] });
    expect(garments.map(withoutBlobs)).toEqual([
      {
        schema: 2,
        id: "4364",
        name: "Marseille hame",
        description: "Kiva hame arkeen ja juhlaan",
        brand: "",
        material: "",
        notes: "",
        category: "bottom-skirt-long",
        colors: [[255, 153, 0], [8, 145, 145]],
        pattern: "patterned",
        occasions: ["everyday", "party"],
        bikeable: true,
        favourite: true,
      },
      {
        schema: 2,
        id: "4361",
        name: "Vihreä bleiseri",
        description: "Sisätakki arkeen ja juhlaan vihreä ja formaalimpi",
        brand: "",
        material: "",
        notes: "",
        category: "layer-overshirt",
        colors: [[31, 173, 138]],
        pattern: "solid",
        occasions: ["everyday"],
        warmth: "cool",
        bikeable: false,
        favourite: false,
      },
    ]);
    expect(await bytes(garments[0]?.image)).toEqual([0xff, 0xd8, 0xff, 1, 2, 3]);
    expect(garments[0]?.image.type).toBe("image/jpeg");
  });
});

describe("importing a container 2 (zip) backup", () => {
  it("keeps everything the user entered", async () => {
    const zip = Uint8Array.from(atob(backupContainer2.trim()), (c) => c.charCodeAt(0));
    const { garments, profile } = await importBackup(zip);

    expect(profile).toEqual({ season: "warm-autumn", palette: [[183, 65, 14]] });
    expect(garments.map(withoutBlobs)).toEqual([
      {
        schema: 2,
        id: "4351",
        name: "Liila neulepaita",
        description: "Lämmin pörröinen neulepaita",
        brand: "Arket",
        material: "villa",
        notes: "lyhyt malli",
        category: "top-long-knit",
        colors: [[204, 153, 255]],
        pattern: "solid",
        occasions: ["everyday", "party"],
        warmth: "warm",
        bikeable: false,
        favourite: true,
        embedding: [0.6, 0.8],
        derivedBy: "briaai/RMBG-1.4+Xenova/siglip-base-patch16-224+crop",
      },
      {
        schema: 2,
        id: "4364",
        name: "Marseille hame",
        description: "",
        brand: "",
        material: "",
        notes: "",
        category: "bottom-skirt-long",
        colors: [[255, 153, 0], [8, 145, 145]],
        pattern: "patterned",
        occasions: ["everyday"],
        bikeable: true,
        favourite: false,
      },
    ]);
    expect(await bytes(garments[0]?.image)).toEqual([0xff, 0xd8, 0xff, 7]);
    expect(await bytes(garments[0]?.cutout)).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(garments[1]?.cutout).toBeUndefined();
  });
});

describe("importBackup", () => {
  it("rejects a file that isn't a backup", async () => {
    await expect(importBackup(strToU8('{"hello": 1}'))).rejects.toThrow("Not a wardrobe export file");
    await expect(importBackup(zipSync({ "muuta.txt": strToU8("hei") }))).rejects.toThrow("Not a wardrobe export file");
  });

  it("rejects an invalid color profile", async () => {
    const json = JSON.stringify({ version: 1, garments: [], profile: { season: "monsoon", palette: [] } });
    await expect(importBackup(strToU8(json))).rejects.toThrow("Invalid color profile");
  });

  it("names the garment and field that can't be read", async () => {
    const zip = unzipSync(await exportBackup([garment("a", [1])], DEFAULT_PROFILE));
    const data = new TextDecoder().decode(zip["vaatteet.json"]).replace("top-long-knit", "space-suit");
    await expect(importBackup(zipSync({ ...zip, "vaatteet.json": strToU8(data) }))).rejects.toThrow(
      "Invalid garment at index 0: Invalid garment field: category",
    );
  });
});
