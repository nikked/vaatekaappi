import { describe, expect, it } from "vitest";
import { isCategory, type Category } from "./garment";
import {
  CATEGORY_PROMPTS,
  normalize,
  rankCategories,
  similarity,
  suggestPattern,
  type LabelledEmbedding,
} from "./suggest";

const SKIRT: Category = "Alaosa > Hameet > Pitkät hameet";
const TROUSERS: Category = "Alaosa > Housut";
const TEE: Category = "Yläosa > Lyhythihaiset > T-paidat";

// Every category gets its own axis in a small space, so similarities are easy to reason about.
const categories = Object.keys(CATEGORY_PROMPTS).filter(isCategory);
const axis = (c: Category): number[] => categories.map((x) => (x === c ? 1 : 0));
const prompts = new Map(categories.map((c) => [c, axis(c)]));
const mix = (parts: [Category, number][]): number[] =>
  normalize(categories.map((c) => parts.find(([p]) => p === c)?.[1] ?? 0));

describe("normalize / similarity", () => {
  it("gives cosine similarity 1 for parallel vectors and 0 for orthogonal ones", () => {
    expect(similarity(normalize([3, 4]), normalize([6, 8]))).toBeCloseTo(1);
    expect(similarity(normalize([1, 0]), normalize([0, 2]))).toBeCloseTo(0);
  });

  it("leaves a zero vector alone", () => {
    expect(normalize([0, 0])).toEqual([0, 0]);
  });
});

describe("rankCategories", () => {
  it("follows the text prompts when there are no examples", () => {
    const image = mix([[SKIRT, 0.8], [TROUSERS, 0.5]]);
    expect(rankCategories(image, prompts, []).slice(0, 2)).toEqual([SKIRT, TROUSERS]);
  });

  it("lets a few examples nudge but not override a clear text match", () => {
    const image = mix([[SKIRT, 0.9], [TROUSERS, 0.3]]);
    const examples: LabelledEmbedding[] = [{ embedding: image, category: TROUSERS }];
    expect(rankCategories(image, prompts, examples)[0]).toBe(SKIRT);
  });

  it("lets many matching examples override the text prompts", () => {
    const image = mix([[SKIRT, 0.6], [TROUSERS, 0.5]]);
    const examples: LabelledEmbedding[] = Array.from({ length: 40 }, () => ({
      embedding: mix([[SKIRT, 0.55], [TROUSERS, 0.5]]),
      category: TROUSERS,
    }));
    expect(rankCategories(image, prompts, [...examples, { embedding: axis(TEE), category: TEE }])[0]).toBe(TROUSERS);
  });

  it("ranks every category exactly once", () => {
    const ranked = rankCategories(axis(TEE), prompts, []);
    expect([...ranked].sort()).toEqual([...categories].sort());
  });
});

describe("suggestPattern", () => {
  it("picks the closer pattern prompt", () => {
    const patternPrompts = { solid: [1, 0], patterned: [0, 1] };
    expect(suggestPattern(normalize([0.9, 0.2]), patternPrompts)).toBe("solid");
    expect(suggestPattern(normalize([0.2, 0.9]), patternPrompts)).toBe("patterned");
  });
});
