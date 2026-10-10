import { describe, expect, it } from "vitest";
import { rgbToLab } from "./color";
import type { Category, Garment, Rgb } from "./garment";
import {
  colorHarmony,
  fitsFilter,
  generateOutfits,
  hasAtMostOnePattern,
  hueDistance,
  labToLch,
  type OutfitFilter,
  pairScore,
  paletteDistance,
  rankOutfits,
  scoreDots,
  scoreOutfit,
  withSlot,
} from "./outfit";
import { WARM_AUTUMN } from "./palette";

const TEE: Category = "top-short-tee";
const KNIT: Category = "top-long-knit";
const TROUSERS: Category = "bottom-trousers";
const SKIRT: Category = "bottom-skirt-long";
const DRESS: Category = "dress";
const COAT: Category = "coat";
const SNEAKERS: Category = "shoes-sneakers";

// LCh hues noted for the colors the tests rely on.
const RUST: Rgb = [183, 65, 14]; // h 48
const ORANGE: Rgb = [204, 85, 0]; // h 54
const OLIVE: Rgb = [128, 128, 0]; // h 103, 55° from rust
const GREEN: Rgb = [40, 160, 60]; // h 142, 88° from orange
const CYAN: Rgb = [0, 160, 200]; // h 236, 182° from orange
const BLUE: Rgb = [0, 110, 190]; // h 275
const COBALT: Rgb = [0, 71, 171]; // h 291
const PURPLE: Rgb = [110, 40, 160]; // h 315
const BLACK: Rgb = [20, 20, 20];
const GREY: Rgb = [128, 128, 128];
const WHITE: Rgb = [250, 250, 250];
const CREAM: Rgb = [255, 253, 208];

const garment = (
  id: string,
  category: Category,
  color: Rgb | null = GREY,
  overrides: Partial<Garment> = {},
): Garment => ({
  schema: 2,
  id,
  name: id,
  description: "",
  brand: "",
  material: "",
  notes: "",
  image: new Blob(),
  cutout: new Blob(),
  embedding: [],
  derivedBy: "test",
  category,
  colors: color ? [color] : [],
  pattern: "solid",
  occasions: ["everyday"],
  bikeable: false,
  favourite: false,
  ...overrides,
});

const ids = (outfits: readonly (readonly Garment[])[]): string[][] =>
  outfits.map((o) => o.map((g) => g.id).sort());

const everydayCool: OutfitFilter = {
  occasion: "everyday",
  weather: "cool",
  cycling: false,
};

describe("generateOutfits", () => {
  it("fills top + bottom, with and without each outer", () => {
    const wardrobe = [
      garment("t", TEE),
      garment("b", TROUSERS),
      garment("c", COAT),
    ];
    expect(ids(generateOutfits(wardrobe))).toEqual([
      ["b", "t"],
      ["b", "c", "t"],
    ]);
  });

  it("produces every combination across slots", () => {
    const wardrobe = [
      garment("t1", TEE),
      garment("t2", KNIT),
      garment("b1", TROUSERS),
      garment("b2", SKIRT),
      garment("c1", COAT),
    ];
    // 2 tops × 2 bottoms × (no outer + 1 outer)
    expect(generateOutfits(wardrobe)).toHaveLength(8);
  });

  it("never combines a dress with a top or bottom", () => {
    const wardrobe = [
      garment("t", TEE),
      garment("b", TROUSERS),
      garment("d", DRESS),
    ];
    expect(ids(generateOutfits(wardrobe))).toEqual([["b", "t"], ["d"]]);
  });

  it("never uses a blazer as the only top: it needs a shirt under it", () => {
    const wardrobe = [garment("bl", "layer-blazer"), garment("b", TROUSERS)];
    expect(generateOutfits(wardrobe)).toEqual([]);
    expect(ids(generateOutfits([...wardrobe, garment("t", TEE)]))).toEqual([
      ["b", "t"],
      ["b", "bl", "t"],
    ]);
  });

  it("leaves out categories without a slot", () => {
    const wardrobe = [
      garment("t", TEE),
      garment("b", TROUSERS),
      garment("s", SNEAKERS),
    ];
    expect(ids(generateOutfits(wardrobe))).toEqual([["b", "t"]]);
  });

  it("produces nothing when a required slot is empty", () => {
    expect(generateOutfits([garment("t", TEE), garment("c", COAT)])).toEqual(
      [],
    );
  });
});

describe("fitsFilter", () => {
  it("requires the occasion", () => {
    expect(
      fitsFilter(
        garment("a", TEE, GREY, { occasions: ["everyday", "party"] }),
        everydayCool,
      ),
    ).toBe(true);
    expect(
      fitsFilter(
        garment("a", TEE, GREY, { occasions: ["party"] }),
        everydayCool,
      ),
    ).toBe(false);
  });

  it("drops airy garments on cool days and warm garments on warm days", () => {
    const airy = garment("a", TROUSERS, GREY, { warmth: "cool" });
    const knit = garment("k", KNIT, GREY, { warmth: "warm" });
    const warmDay: OutfitFilter = { ...everydayCool, weather: "warm" };
    expect(fitsFilter(airy, everydayCool)).toBe(false);
    expect(fitsFilter(knit, everydayCool)).toBe(true);
    expect(fitsFilter(airy, warmDay)).toBe(true);
    expect(fitsFilter(knit, warmDay)).toBe(false);
  });

  it("lets garments without warmth fit any weather", () => {
    expect(fitsFilter(garment("a", TEE), everydayCool)).toBe(true);
    expect(
      fitsFilter(garment("a", TEE), { ...everydayCool, weather: "warm" }),
    ).toBe(true);
  });

  it("requires bikeable bottoms when cycling, and only bottoms", () => {
    const cycling: OutfitFilter = { ...everydayCool, cycling: true };
    expect(
      fitsFilter(garment("s", SKIRT, GREY, { bikeable: true }), cycling),
    ).toBe(true);
    expect(fitsFilter(garment("s", SKIRT), cycling)).toBe(false);
    expect(fitsFilter(garment("t", TEE), cycling)).toBe(true);
  });
});

describe("hasAtMostOnePattern", () => {
  it("allows all solid or a single pattern", () => {
    expect(
      hasAtMostOnePattern([garment("a", TEE), garment("b", TROUSERS)]),
    ).toBe(true);
    expect(
      hasAtMostOnePattern([
        garment("a", TEE, GREY, { pattern: "patterned" }),
        garment("b", TROUSERS),
      ]),
    ).toBe(true);
  });

  it("rejects two patterned garments", () => {
    const outfit = [
      garment("a", TEE, GREY, { pattern: "patterned" }),
      garment("b", SKIRT, GREY, { pattern: "patterned" }),
    ];
    expect(hasAtMostOnePattern(outfit)).toBe(false);
  });
});

describe("labToLch", () => {
  it("gives zero chroma for grey and hue 0 for +a", () => {
    expect(labToLch(rgbToLab(GREY))[1]).toBeCloseTo(0, 1);
    expect(labToLch([50, 10, 0])).toEqual([50, 10, 0]);
  });

  it("wraps negative angles into 0–360", () => {
    expect(labToLch([50, 0, -10])[2]).toBeCloseTo(270);
  });
});

describe("hueDistance", () => {
  it("takes the short way round the circle", () => {
    expect(hueDistance(10, 350)).toBe(20);
    expect(hueDistance(0, 180)).toBe(180);
    expect(hueDistance(90, 90)).toBe(0);
  });
});

describe("pairScore", () => {
  it("rewards analogous (≤60°) and complementary hues and penalizes the rest", () => {
    expect(pairScore(40, 95)).toBeGreaterThan(0);
    expect(pairScore(350, 15)).toBeGreaterThan(0);
    expect(pairScore(0, 165)).toBeGreaterThan(0);
    expect(pairScore(0, 90)).toBeLessThan(0);
    expect(pairScore(0, 155)).toBeLessThan(0);
  });
});

describe("paletteDistance", () => {
  it("is zero when every garment's dominant color is in the palette", () => {
    expect(paletteDistance([garment("a", TEE, RUST)], WARM_AUTUMN)).toBeCloseTo(
      0,
    );
  });

  it("uses only the first color of each garment", () => {
    const g = garment("a", SKIRT, RUST, { colors: [RUST, COBALT] });
    expect(paletteDistance([g], WARM_AUTUMN)).toBeCloseTo(0);
  });

  it("is set by the worst-fitting garment", () => {
    const cobaltOnly = paletteDistance(
      [garment("c", TEE, COBALT)],
      WARM_AUTUMN,
    );
    expect(
      paletteDistance(
        [garment("r", TEE, RUST), garment("c", TEE, COBALT)],
        WARM_AUTUMN,
      ),
    ).toBe(cobaltOnly);
  });

  it("is larger for icy cool colors than for warm ones", () => {
    const warm = paletteDistance([garment("a", TEE, ORANGE)], WARM_AUTUMN);
    const cool = paletteDistance([garment("a", TEE, COBALT)], WARM_AUTUMN);
    expect(cool).toBeGreaterThan(warm + 10);
  });

  it("ignores garments without colors", () => {
    const empty = garment("e", TEE, null);
    expect(
      paletteDistance([garment("a", TEE, RUST), empty], WARM_AUTUMN),
    ).toBeCloseTo(0);
    expect(paletteDistance([empty], WARM_AUTUMN)).toBe(0);
  });
});

describe("colorHarmony", () => {
  const outfitOf = (...colors: Rgb[]) =>
    colors.map((c, i) => garment(String(i), TEE, c));
  const goodPair = colorHarmony(outfitOf(RUST, ORANGE));

  it("treats low-chroma colors, cream included, as neutrals that score like a good pair", () => {
    expect(colorHarmony(outfitOf(BLACK, WHITE, GREY, CREAM))).toBe(goodPair);
  });

  it("scores one color + neutrals the same as a good pair, so extra layers don't win", () => {
    expect(colorHarmony(outfitOf(BLACK, COBALT, WHITE))).toBe(goodPair);
    expect(colorHarmony(outfitOf(ORANGE))).toBe(
      colorHarmony(outfitOf(ORANGE, RUST)),
    );
  });

  it("counts rust + olive as harmonious", () => {
    expect(colorHarmony(outfitOf(RUST, OLIVE))).toBe(goodPair);
  });

  it("rewards complementary pairs", () => {
    expect(colorHarmony(outfitOf(ORANGE, CYAN))).toBe(goodPair);
  });

  it("penalizes a 90° clash", () => {
    expect(colorHarmony(outfitOf(ORANGE, GREEN))).toBeLessThan(0);
  });

  it("penalizes more than two distinct hues on top of the pair scores", () => {
    const threeHues = colorHarmony(outfitOf(RUST, GREEN, BLUE));
    expect(threeHues).toBeLessThan(colorHarmony(outfitOf(RUST, GREEN)));
    expect(threeHues).toBeLessThan(-1);
  });

  it("counts analogous colors as one hue", () => {
    expect(colorHarmony(outfitOf(RUST, ORANGE, RUST))).toBe(goodPair);
  });

  it("ignores garments without colors", () => {
    expect(
      colorHarmony([garment("a", TEE, ORANGE), garment("b", TEE, null)]),
    ).toBe(goodPair);
  });
});

describe("scoreOutfit", () => {
  const outfitOf = (...colors: Rgb[]) =>
    colors.map((c, i) => garment(String(i), TEE, c));

  it("ranks an all-neutral outfit above a clashing one", () => {
    expect(
      scoreOutfit(outfitOf(BLACK, WHITE, GREY), WARM_AUTUMN),
    ).toBeGreaterThan(scoreOutfit(outfitOf(ORANGE, GREEN, BLACK), WARM_AUTUMN));
  });

  it("ranks warm autumn colors above icy cool ones with equal harmony", () => {
    expect(scoreOutfit(outfitOf(RUST, ORANGE), WARM_AUTUMN)).toBeGreaterThan(
      scoreOutfit(outfitOf(COBALT, PURPLE), WARM_AUTUMN),
    );
  });

  it("ranks complementary above a 90° clash", () => {
    expect(scoreOutfit(outfitOf(ORANGE, CYAN), WARM_AUTUMN)).toBeGreaterThan(
      scoreOutfit(outfitOf(ORANGE, GREEN), WARM_AUTUMN),
    );
  });
});

describe("rankOutfits", () => {
  it("returns outfits best first with their garment ids", () => {
    const wardrobe = [
      garment("rust-top", KNIT, RUST),
      garment("green-top", TEE, GREEN),
      garment("orange-skirt", SKIRT, ORANGE),
    ];
    const ranked = rankOutfits(wardrobe, everydayCool, WARM_AUTUMN);
    expect(ranked.map((o) => o.garmentIds)).toEqual([
      ["rust-top", "orange-skirt"],
      ["green-top", "orange-skirt"],
    ]);
    const [best, next] = ranked;
    expect(best?.score).toBeGreaterThan(
      next?.score ?? Number.POSITIVE_INFINITY,
    );
  });

  it("does not prefer adding a matching coat over the same outfit without it", () => {
    const wardrobe = [
      garment("orange-top", TEE, ORANGE),
      garment("black-trousers", TROUSERS, BLACK),
      garment("rust-coat", COAT, RUST),
    ];
    const [first, second] = rankOutfits(wardrobe, everydayCool, WARM_AUTUMN);
    expect(first?.score).toBeCloseTo(second?.score ?? Number.NaN, 1);
  });

  it("drops garments that don't fit the filter", () => {
    const wardrobe = [
      garment("top", TEE),
      garment("party-top", TEE, GREY, { occasions: ["party"] }),
      garment("airy-top", TEE, GREY, { warmth: "cool" }),
      garment("bottom", TROUSERS),
    ];
    expect(
      rankOutfits(wardrobe, everydayCool, WARM_AUTUMN).map((o) => o.garmentIds),
    ).toEqual([["top", "bottom"]]);
  });

  it("drops outfits with more than one pattern", () => {
    const wardrobe = [
      garment("patterned-top", TEE, GREY, { pattern: "patterned" }),
      garment("patterned-skirt", SKIRT, GREY, { pattern: "patterned" }),
      garment("plain-skirt", SKIRT),
    ];
    expect(
      rankOutfits(wardrobe, everydayCool, WARM_AUTUMN).map((o) => o.garmentIds),
    ).toEqual([["patterned-top", "plain-skirt"]]);
  });

  it("ranks by the palette it is given", () => {
    const wardrobe = [
      garment("rust-top", TEE, RUST),
      garment("cobalt-top", TEE, COBALT),
      garment("b", TROUSERS, BLACK),
    ];
    const first = (palette: readonly Rgb[]) =>
      rankOutfits(wardrobe, everydayCool, palette)[0]?.garmentIds[0];
    expect(first(WARM_AUTUMN)).toBe("rust-top");
    expect(first([COBALT, BLACK])).toBe("cobalt-top");
  });

  it("returns nothing for an empty wardrobe", () => {
    expect(rankOutfits([], everydayCool, WARM_AUTUMN)).toEqual([]);
  });
});

describe("withSlot", () => {
  const top = garment("t", TEE);
  const bottom = garment("b", TROUSERS);

  it("replaces the garment in a slot", () => {
    expect(
      ids([withSlot([top, bottom], "bottom", garment("s", SKIRT))]),
    ).toEqual([["s", "t"]]);
  });

  it("adds to an empty slot and removes with undefined", () => {
    const coat = garment("c", COAT);
    expect(ids([withSlot([top, bottom], "outer", coat)])).toEqual([
      ["b", "c", "t"],
    ]);
    expect(ids([withSlot([top, bottom, coat], "outer", undefined)])).toEqual([
      ["b", "t"],
    ]);
  });
});

describe("scoreDots", () => {
  it("maps the best outfit to 5 dots and the worst to 1", () => {
    expect(scoreDots(1, 1, -3)).toBe(5);
    expect(scoreDots(-3, 1, -3)).toBe(1);
    expect(scoreDots(-1, 1, -3)).toBe(3);
  });

  it("gives full dots when all outfits score the same", () => {
    expect(scoreDots(0.5, 0.5, 0.5)).toBe(5);
  });

  it("keeps nearly equal outfits nearly equal in a short list", () => {
    expect(scoreDots(-0.32, -0.14, -0.32)).toBe(5);
  });

  it("clamps scores outside the listed range", () => {
    expect(scoreDots(3, 1, -3)).toBe(5);
    expect(scoreDots(-9, 1, -3)).toBe(1);
  });
});
