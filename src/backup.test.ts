import { describe, expect, it } from "vitest";
import { exportWardrobe, importWardrobe } from "./backup";
import type { Garment } from "./garment";

const garment = (id: string, bytes: number[]): Garment => ({
  id,
  image: new Blob([new Uint8Array(bytes)], { type: "image/png" }),
  category: "sweater",
  colors: [[150, 75, 30]],
  colorsUncertain: false,
  season: ["autumn", "winter"],
  formality: "casual",
  pattern: "solid",
});

describe("export → import", () => {
  it("round-trips garments including image bytes", async () => {
    const original = [garment("a", [0, 1, 2, 255]), garment("b", [137, 80, 78, 71])];
    const restored = await importWardrobe(await exportWardrobe(original));

    expect(restored.map(({ image: _, ...rest }) => rest)).toEqual(
      original.map(({ image: _, ...rest }) => rest),
    );
    for (const [i, g] of restored.entries()) {
      expect(g.image.type).toBe("image/png");
      expect(new Uint8Array(await g.image.arrayBuffer())).toEqual(
        new Uint8Array(await original[i]!.image.arrayBuffer()),
      );
    }
  });
});

describe("importWardrobe", () => {
  it("rejects a file that isn't an export", async () => {
    await expect(importWardrobe('{"hello": 1}')).rejects.toThrow("Not a wardrobe export file");
  });

  it("rejects a garment with an unknown category", async () => {
    const json = await exportWardrobe([garment("a", [1])]);
    await expect(importWardrobe(json.replace("sweater", "spacesuit"))).rejects.toThrow(
      "Invalid garment at index 0",
    );
  });
});
