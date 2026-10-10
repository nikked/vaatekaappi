import { PATTERNS, type Category, type Pattern } from "./garment";

export type Embedding = readonly number[];

export type LabelledEmbedding = { embedding: Embedding; category: Category };

// English prompts: the model was trained on English captions.
export const CATEGORY_PROMPTS: Record<Category, string> = {
  "Yläosa > Pitkähihaiset > Kauluspaidat": "a long-sleeved button-up shirt",
  "Yläosa > Pitkähihaiset > Neulepaidat": "a knitted sweater",
  "Yläosa > Lyhythihaiset > Kauluspaidat": "a short-sleeved button-up shirt",
  "Yläosa > Lyhythihaiset > T-paidat": "a t-shirt",
  "Alaosa > Housut": "a pair of trousers",
  "Alaosa > Hameet > Pitkät hameet": "a long skirt",
  "Alaosa > Hameet > Lyhyet hameet": "a short skirt",
  "Alaosa > Shortsit": "a pair of shorts",
  Mekot: "a dress",
  "Päällysosat > Sisätakit": "a light jacket or overshirt",
  "Päällysosat > Bleiserit": "a blazer",
  "Päällysosat > Neuletakit": "a knitted cardigan",
  Takit: "a coat",
  Sukat: "a pair of socks",
  "Kengät > Sandaalit": "a pair of sandals",
  "Kengät > Lenkkarit": "a pair of sneakers",
  "Kengät > Korkkarit": "a pair of high heels",
  "Päähineet > Lippikset": "a cap",
  Korut: "a piece of jewelry",
  Asusteet: "a belt or a scarf",
  Alusvaatteet: "underwear",
};

export const PATTERN_PROMPTS: Record<Pattern, string> = {
  solid: "a plain solid-colored garment",
  patterned: "a patterned garment",
};

export const toPromptText = (prompt: string): string => `a photo of ${prompt}`;

// How many confirmed garments it takes for examples to weigh as much as the
// text prompts. With few examples the prompts dominate.
export const EXAMPLES_FOR_EQUAL_WEIGHT = 20;

const dot = (a: Embedding, b: Embedding): number => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);

export const normalize = (v: Embedding): number[] => {
  const length = Math.sqrt(dot(v, v));
  return length === 0 ? [...v] : v.map((x) => x / length);
};

// Embeddings are normalized on creation, so cosine similarity is the dot product.
export const similarity = dot;

// Image–text and image–image similarities live on different scales, so each
// signal is standardized across categories before blending.
const standardize = (values: readonly number[]): number[] => {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  return values.map((v) => (sd === 0 ? 0 : (v - mean) / sd));
};

const nearestExample = (
  image: Embedding,
  category: Category,
  examples: readonly LabelledEmbedding[],
): number | undefined => {
  const sims = examples.filter((e) => e.category === category).map((e) => similarity(image, e.embedding));
  return sims.length === 0 ? undefined : Math.max(...sims);
};

export const rankCategories = (
  image: Embedding,
  prompts: ReadonlyMap<Category, Embedding>,
  examples: readonly LabelledEmbedding[],
): Category[] => {
  const categories = [...prompts.keys()];
  const textScores = standardize([...prompts.values()].map((p) => similarity(image, p)));

  const nearest = categories.map((c) => nearestExample(image, c, examples));
  const known = nearest.filter((n) => n !== undefined);
  // Categories without examples get the lowest seen similarity: no evidence for them.
  const floor = known.length === 0 ? 0 : Math.min(...known);
  const exampleScores = standardize(nearest.map((n) => n ?? floor));

  const weight = examples.length / (examples.length + EXAMPLES_FOR_EQUAL_WEIGHT);
  const score = (i: number) => (1 - weight) * (textScores[i] ?? 0) + weight * (exampleScores[i] ?? 0);
  return categories
    .map((category, i) => ({ category, score: score(i) }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.category);
};

export const suggestPattern = (
  image: Embedding,
  prompts: Readonly<Record<Pattern, Embedding>>,
): Pattern =>
  PATTERNS.reduce((best, p) => (similarity(image, prompts[p]) > similarity(image, prompts[best]) ? p : best));
