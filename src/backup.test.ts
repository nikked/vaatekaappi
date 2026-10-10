import { describe, expect, it } from "vitest";
import { exportWardrobe, importWardrobe } from "./backup";
import { DEFAULT_PROFILE, profileFor } from "./palette";
import type { Garment } from "./garment";

const garment = (id: string, bytes: number[]): Garment => ({
  id,
  image: new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }),
  cutout: new Blob([new Uint8Array([...bytes, 9])], { type: "image/png" }),
  embedding: [0.6, 0.8],
  name: "Liila neulepaita",
  description: "Lämmin pörröinen neulepaita",
  category: "Yläosa > Pitkähihaiset > Neulepaidat",
  colors: [[204, 153, 255]],
  pattern: "solid",
  occasions: ["everyday", "party"],
  warmth: "warm",
  bikeable: false,
  favourite: true,
});

describe("export → import", () => {
  it("round-trips garments including image and cut-out bytes", async () => {
    const original = [garment("a", [0, 1, 2, 255]), garment("b", [137, 80, 78, 71])];
    const { garments: restored } = await importWardrobe(await exportWardrobe(original, DEFAULT_PROFILE));

    expect(restored.map(({ image: _, cutout: __, ...rest }) => rest)).toEqual(
      original.map(({ image: _, cutout: __, ...rest }) => rest),
    );
    const bytes = async (blob: Blob | undefined) => [...new Uint8Array((await blob?.arrayBuffer()) ?? new ArrayBuffer(0))];
    for (const [i, g] of restored.entries()) {
      expect(g.image.type).toBe("image/jpeg");
      expect(g.cutout?.type).toBe("image/png");
      expect(await bytes(g.image)).toEqual(await bytes(original[i]?.image));
      expect(await bytes(g.cutout)).toEqual(await bytes(original[i]?.cutout));
    }
  });
});

describe("importWardrobe", () => {
  it("accepts garments without cut-out and embedding, like the hand-made example file", async () => {
    const json = JSON.stringify({
      version: 1,
      garments: [{ ...garment("a", [1]), image: "data:image/jpeg;base64,AQ==", cutout: undefined, embedding: undefined }],
    });
    const {
      garments: [restored],
      profile,
    } = await importWardrobe(json);
    expect(profile).toBeUndefined();
    expect(restored?.cutout).toBeUndefined();
    expect(restored?.embedding).toBeUndefined();
  });

  it("rejects a file that isn't an export", async () => {
    await expect(importWardrobe('{"hello": 1}')).rejects.toThrow("Not a wardrobe export file");
  });

  it("moves garments exported under an old category path", async () => {
    const json = await exportWardrobe([{ ...garment("a", [1]), category: "Päällysosat > Bleiserit" }], DEFAULT_PROFILE);
    const {
      garments: [restored],
    } = await importWardrobe(json.replace("Päällysosat > Bleiserit", "Yläosa > Pitkähihaiset > Bleiserit"));
    expect(restored?.category).toBe("Päällysosat > Bleiserit");
  });

  it("round-trips an edited color profile", async () => {
    const profile = { ...profileFor("soft-summer"), palette: [[1, 2, 3] as const] };
    const restored = await importWardrobe(await exportWardrobe([], profile));
    expect(restored.profile).toEqual({ season: "soft-summer", palette: [[1, 2, 3]] });
  });

  it("rejects an invalid color profile", async () => {
    const json = JSON.stringify({ version: 1, garments: [], profile: { season: "monsoon", palette: [] } });
    await expect(importWardrobe(json)).rejects.toThrow("Invalid color profile");
  });

  it("rejects a garment with an unknown category", async () => {
    const json = await exportWardrobe([garment("a", [1])], DEFAULT_PROFILE);
    await expect(importWardrobe(json.replace("Neulepaidat", "Avaruuspuvut"))).rejects.toThrow(
      "Invalid garment at index 0",
    );
  });
});
