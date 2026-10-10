import { describe, expect, it } from "vitest";
import { currentCategory, isCategory } from "./garment";

describe("currentCategory", () => {
  it("moves layering garments from their old paths to Päällysosat", () => {
    expect(currentCategory("Takit > Sisätakit")).toBe("Päällysosat > Sisätakit");
    expect(currentCategory("Yläosa > Pitkähihaiset > Bleiserit")).toBe("Päällysosat > Bleiserit");
    expect(currentCategory("Yläosa > Pitkähihaiset > Neuletakit")).toBe("Päällysosat > Neuletakit");
  });

  it("leaves current categories and unknown values alone", () => {
    expect(currentCategory("Takit")).toBe("Takit");
    expect(currentCategory("Avaruuspuvut")).toBe("Avaruuspuvut");
    expect(currentCategory(42)).toBe(42);
  });

  it("only maps to categories that exist", () => {
    for (const old of ["Takit > Sisätakit", "Yläosa > Pitkähihaiset > Bleiserit", "Yläosa > Pitkähihaiset > Neuletakit"]) {
      expect(isCategory(currentCategory(old))).toBe(true);
      expect(isCategory(old)).toBe(false);
    }
  });
});
