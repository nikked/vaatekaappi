import { describe, expect, it } from "vitest";
import { exportWardrobe, importWardrobe } from "./backup";
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

describe("export → import", () => {
  it("round-trips every field, photo and cut-out", async () => {
    const original = [garment("a", [0, 1, 2, 255]), garment("b", [137, 80, 78, 71])];
    const { garments: restored } = await importWardrobe(await exportWardrobe(original, DEFAULT_PROFILE));

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
    const { garments } = await importWardrobe(await exportWardrobe([unprocessed], DEFAULT_PROFILE));
    expect(garments.map(withoutBlobs)).toEqual([withoutBlobs(unprocessed)]);
  });

  it("round-trips an edited color profile", async () => {
    const profile = { ...profileFor("soft-summer"), palette: [[1, 2, 3] as const] };
    const restored = await importWardrobe(await exportWardrobe([], profile));
    expect(restored.profile).toEqual({ season: "soft-summer", palette: [[1, 2, 3]] });
  });
});

// Backups made by earlier versions of the app must import forever.
describe("importing a schema 1 backup", () => {
  it("keeps everything the user entered", async () => {
    const { garments, profile } = await importWardrobe(backupSchema1);

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

describe("importWardrobe", () => {
  it("rejects a file that isn't an export", async () => {
    await expect(importWardrobe('{"hello": 1}')).rejects.toThrow("Not a wardrobe export file");
  });

  it("rejects an invalid color profile", async () => {
    const json = JSON.stringify({ version: 1, garments: [], profile: { season: "monsoon", palette: [] } });
    await expect(importWardrobe(json)).rejects.toThrow("Invalid color profile");
  });

  it("names the garment and field that can't be read", async () => {
    const json = await exportWardrobe([garment("a", [1])], DEFAULT_PROFILE);
    await expect(importWardrobe(json.replace("top-long-knit", "space-suit"))).rejects.toThrow(
      "Invalid garment at index 0: Invalid garment field: category",
    );
  });
});
