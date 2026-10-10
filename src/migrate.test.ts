import { describe, expect, it } from "vitest";
import { migrateGarment } from "./migrate";

const image = new Blob([new Uint8Array([1])], { type: "image/jpeg" });
const cutout = new Blob([new Uint8Array([2])], { type: "image/png" });

const v1 = {
  id: "4364",
  name: "Marseille hame",
  description: "Kiva hame arkeen ja juhlaan",
  image,
  cutout,
  embedding: [0.6, 0.8],
  category: "Alaosa > Hameet > Pitkät hameet",
  colors: [
    [255, 153, 0],
    [8, 145, 145],
  ],
  pattern: "patterned",
  occasions: ["everyday", "party"],
  bikeable: true,
  favourite: true,
};

const v2 = {
  schema: 2,
  id: "4351",
  image,
  name: "Liila neulepaita",
  description: "",
  brand: "Arket",
  material: "villa",
  notes: "lyhyt malli",
  category: "top-long-knit",
  colors: [[204, 153, 255]],
  pattern: "solid",
  occasions: ["everyday"],
  warmth: "warm",
  bikeable: false,
  favourite: false,
  cutout,
  embedding: [1, 0],
  derivedBy: "models-a",
};

describe("migrateGarment from schema 1", () => {
  it("keeps everything the user entered and maps the category path to its id", () => {
    expect(migrateGarment(v1)).toEqual({
      schema: 2,
      id: "4364",
      image,
      name: "Marseille hame",
      description: "Kiva hame arkeen ja juhlaan",
      brand: "",
      material: "",
      notes: "",
      category: "bottom-skirt-long",
      colors: v1.colors,
      pattern: "patterned",
      occasions: ["everyday", "party"],
      bikeable: true,
      favourite: true,
    });
  });

  it("drops the cut-out and embedding, which don't say which models made them", () => {
    const migrated = migrateGarment(v1);
    expect(migrated.cutout).toBeUndefined();
    expect(migrated.embedding).toBeUndefined();
  });

  it("maps paths that had already moved before schema 2", () => {
    expect(migrateGarment({ ...v1, category: "Takit > Sisätakit" }).category).toBe("layer-overshirt");
    expect(migrateGarment({ ...v1, category: "Yläosa > Pitkähihaiset > Bleiserit" }).category).toBe("layer-blazer");
    expect(migrateGarment({ ...v1, category: "Päällysosat > Neuletakit" }).category).toBe("layer-cardigan");
  });
});

describe("migrateGarment on the current schema", () => {
  it("returns a valid record unchanged", () => {
    expect(migrateGarment(v2)).toEqual(v2);
  });

  it("drops derived data unless all of it is present", () => {
    const { derivedBy: _, ...partial } = v2;
    const migrated = migrateGarment(partial);
    expect(migrated.cutout).toBeUndefined();
    expect(migrated.embedding).toBeUndefined();
  });

  it("drops fields it doesn't know", () => {
    expect(migrateGarment({ ...v2, leftover: 1 })).toEqual(v2);
  });
});

describe("migrateGarment on unreadable input", () => {
  it("names the field that is wrong", () => {
    expect(() => migrateGarment({ ...v2, category: "Avaruuspuvut" })).toThrow("Invalid garment field: category");
    expect(() => migrateGarment({ ...v1, image: "nope" })).toThrow("Invalid garment field: image");
  });

  it("rejects a schema newer than this app knows", () => {
    expect(() => migrateGarment({ ...v2, schema: 3 })).toThrow("Invalid garment field: schema");
  });
});
