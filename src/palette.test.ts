import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE,
  profileFor,
  SEASON_PALETTES,
  SEASON_TYPES,
} from "./palette";

describe("SEASON_PALETTES", () => {
  it("gives every season type a full palette with no unparsed colors", () => {
    for (const season of SEASON_TYPES)
      expect(SEASON_PALETTES[season]).toHaveLength(
        season === "warm-autumn" ? 16 : 12,
      );
  });
});

describe("profileFor", () => {
  it("copies the preset so editing the profile can't change it", () => {
    const profile = profileFor("cool-winter");
    profile.palette.pop();
    expect(SEASON_PALETTES["cool-winter"]).toHaveLength(12);
  });

  it("defaults to warm autumn", () => {
    expect(DEFAULT_PROFILE.season).toBe("warm-autumn");
  });
});
