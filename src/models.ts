import {
  AutoProcessor,
  AutoTokenizer,
  PreTrainedModel,
  RawImage,
  SiglipTextModel,
  SiglipVisionModel,
  type ProgressInfo,
} from "@huggingface/transformers";
import { isCategory, type Category, type Pattern } from "./garment";
import { applyProgress, type Downloads } from "./downloads";
import { flattenOnWhite, withAlpha } from "./image";
import {
  CATEGORY_PROMPTS,
  PATTERN_PROMPTS,
  normalize,
  toPromptText,
  type Embedding,
} from "./suggest";

// BiRefNet (MIT) was tried first: it exceeds Apple GPUs' WebGPU limits and runs
// out of WASM memory. RMBG-1.4's license allows personal, non-commercial use.
const SEGMENTER = "briaai/RMBG-1.4";
// Picked over CLIP on the example garments: 6/7 vs 4/7 categories right first.
const EMBEDDER = "Xenova/siglip-base-patch16-224";

// Stored with every cut-out and embedding. Change it whenever the models or how
// their output is post-processed change: older garments are then recomputed.
export const DERIVED_BY = `${SEGMENTER}+${EMBEDDER}+crop`;

// Left undefined, transformers.js uses WASM in the browser and CPU in Node.
const device = globalThis.navigator?.gpu ? "webgpu" : undefined;

export type ModelStatus = { state: "loading" | "ready" | "failed"; downloads: Downloads };

let status: ModelStatus = { state: "loading", downloads: new Map() };
const listeners = new Set<() => void>();

const setStatus = (next: ModelStatus) => {
  status = next;
  for (const listener of listeners) listener();
};

// For useSyncExternalStore: the UI shows download progress while models load.
export const subscribeModelStatus = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getModelStatus = (): ModelStatus => status;

const progress_callback = (info: ProgressInfo) => {
  const downloads = applyProgress(status.downloads, info);
  if (downloads !== status.downloads) setStatus({ ...status, downloads });
};

const once = <T>(load: () => Promise<T>): (() => Promise<T>) => {
  let loaded: Promise<T> | undefined;
  return () => (loaded ??= load());
};

// The model's config isn't recognized by the background-removal pipeline, so it
// is loaded with the base model class and its preprocessing spelled out.
// WebGPU fp16 takes ~0.3 s per photo; the WASM fallback ~8 s.
const segmenter = once(async () => ({
  model: await PreTrainedModel.from_pretrained(
    SEGMENTER,
    device ? { device, dtype: "fp16", progress_callback } : { dtype: "q8", progress_callback },
  ),
  processor: await AutoProcessor.from_pretrained(SEGMENTER, {
    progress_callback,
    config: {
      do_normalize: true,
      do_pad: false,
      do_rescale: true,
      do_resize: true,
      image_mean: [0.5, 0.5, 0.5],
      feature_extractor_type: "ImageFeatureExtractor",
      image_std: [1, 1, 1],
      resample: 2,
      rescale_factor: 1 / 255,
      size: { width: 1024, height: 1024 },
    },
  }),
}));

const vision = once(async () => ({
  processor: await AutoProcessor.from_pretrained(EMBEDDER, { progress_callback }),
  model: await SiglipVisionModel.from_pretrained(EMBEDDER, { dtype: "q8", device, progress_callback }),
}));

const text = once(async () => ({
  tokenizer: await AutoTokenizer.from_pretrained(EMBEDDER, { progress_callback }),
  model: await SiglipTextModel.from_pretrained(EMBEDDER, { dtype: "q8", device, progress_callback }),
}));

const rows = (data: Float32Array, dims: readonly number[]): number[][] => {
  const [count = 0, size = 0] = dims;
  return Array.from({ length: count }, (_, i) => normalize(Array.from(data.subarray(i * size, (i + 1) * size))));
};

/** RGBA image of the garment with the background made transparent. */
export const segment = async (input: Blob | string): Promise<RawImage> => {
  const { model, processor } = await segmenter();
  const image = await RawImage.read(input);
  const { pixel_values } = await processor(image);
  const { output } = await model({ input: pixel_values });
  const mask = await RawImage.fromTensor(output[0].mul(255).to("uint8")).resize(image.width, image.height);
  return new RawImage(withAlpha(image.rgba().data, mask.data), image.width, image.height, 4);
};

// Embedded on white so the backgrounds of different photos don't make them look alike.
export const embedCutout = async (cutout: RawImage): Promise<number[]> => {
  const { processor, model } = await vision();
  const flat = new RawImage(flattenOnWhite(cutout.rgba().data), cutout.width, cutout.height, 3);
  const { pooler_output } = await model(await processor(flat));
  return rows(pooler_output.data, pooler_output.dims)[0] ?? [];
};

const embedTexts = async (texts: readonly string[]): Promise<number[][]> => {
  const { tokenizer, model } = await text();
  const { pooler_output } = await model(tokenizer([...texts], { padding: "max_length", truncation: true }));
  return rows(pooler_output.data, pooler_output.dims);
};

export type Prompts = {
  categories: ReadonlyMap<Category, Embedding>;
  patterns: Readonly<Record<Pattern, Embedding>>;
};

export const prompts = once(async (): Promise<Prompts> => {
  const categories = Object.keys(CATEGORY_PROMPTS).filter(isCategory);
  const texts = [...categories.map((c) => CATEGORY_PROMPTS[c]), PATTERN_PROMPTS.solid, PATTERN_PROMPTS.patterned];
  const embedded = await embedTexts(texts.map(toPromptText));
  const [solid = [], patterned = []] = embedded.slice(categories.length);
  return {
    categories: new Map(categories.map((c, i) => [c, embedded[i] ?? []])),
    patterns: { solid, patterned },
  };
});

/** Starts all downloads so the first photo doesn't wait for them. */
export const warmUp = (): Promise<unknown> =>
  Promise.all([segmenter(), vision(), prompts()]).then(
    () => setStatus({ ...status, state: "ready" }),
    (e: unknown) => {
      setStatus({ ...status, state: "failed" });
      throw e;
    },
  );
