import { env } from "@huggingface/transformers";
import { describe, expect, it } from "vitest";
import { isCategory, isOneOf, PATTERNS, type Category, type Pattern } from "./garment";
import { embedCutout, prompts, segment } from "./models";
import { rankCategories, suggestPattern, type LabelledEmbedding } from "./suggest";

// Opt-in: downloads ~320 MB of models once and needs the local example photos.
// Run with: VITE_INTEGRATION=1 npx vitest run src/models.integration.test.ts
const files = import.meta.glob<{ default: unknown[] }>("../initial_data/examples.json", { eager: true });
const raw = Object.values(files)[0]?.default ?? [];

type Example = { id: string; category: Category; pattern: Pattern };
const examples: Example[] = raw.flatMap((e) =>
  typeof e === "object" && e !== null && "id" in e && "category" in e && "pattern" in e &&
  typeof e.id === "string" && isCategory(e.category) && isOneOf(PATTERNS)(e.pattern)
    ? [{ id: e.id, category: e.category, pattern: e.pattern }]
    : [],
);

env.cacheDir = "initial_data/.models";

describe.runIf(import.meta.env.VITE_INTEGRATION === "1" && examples.length > 0)(
  "suggestions on the example photos",
  () => {
    it("ranks the right category first for most garments and in the top 3 for all", async () => {
      const { categories, patterns } = await prompts();
      const embedded = await Promise.all(
        examples.map(async (e) => ({ ...e, embedding: await embedCutout(await segment(`initial_data/jpeg/${e.id}.jpg`)) })),
      );

      const results = embedded.map((e) => {
        const others: LabelledEmbedding[] = embedded.filter((o) => o.id !== e.id);
        const ranked = rankCategories(e.embedding, categories, others);
        return { id: e.id, rank: ranked.indexOf(e.category), pattern: suggestPattern(e.embedding, patterns) === e.pattern };
      });
      console.table(results);

      expect(results.filter((r) => r.rank === 0).length).toBeGreaterThanOrEqual(examples.length - 2);
      expect(results.every((r) => r.rank >= 0 && r.rank < 3)).toBe(true);
      expect(results.every((r) => r.pattern)).toBe(true);
    }, 300_000);
  },
);
