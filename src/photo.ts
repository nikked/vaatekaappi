import { RawImage } from "@huggingface/transformers";
import { cutoutColors } from "./color";
import {
  DEFAULT_CATEGORY,
  GARMENT_SCHEMA,
  type Category,
  type Derived,
  type Garment,
  type Rgb,
  type StoredGarment,
} from "./garment";
import { cropRgba, downscale, loadPixels, opaqueBounds } from "./image";
import { DERIVED_BY, embedCutout, prompts, segment } from "./models";
import { rankCategories, suggestPattern, type LabelledEmbedding } from "./suggest";

// Kept as the source for any future recomputation; models only need 1024 px.
const STORED_PHOTO_SIZE = 2048;
const MODEL_INPUT_SIZE = 1024;

// Cropped for display only: embeddings of the uncropped cut-out rank categories better.
const cropToGarment = (raw: RawImage): RawImage => {
  const bounds = opaqueBounds(raw.data, raw.width);
  return bounds ? new RawImage(cropRgba(raw.data, raw.width, bounds), bounds.width, bounds.height, 4) : raw;
};

const derive = async (image: Blob): Promise<Derived & { colors: Rgb[] }> => {
  const raw = await segment(await downscale(image, MODEL_INPUT_SIZE));
  const cutout: unknown = await cropToGarment(raw).toBlob("image/png");
  if (!(cutout instanceof Blob)) throw new Error("Cut-out could not be encoded as PNG");
  return {
    cutout,
    embedding: await embedCutout(raw),
    derivedBy: DERIVED_BY,
    colors: cutoutColors(await loadPixels(cutout)),
  };
};

export const isUpToDate = (g: StoredGarment): g is Garment =>
  g.cutout !== undefined && g.embedding !== undefined && g.derivedBy === DERIVED_BY;

export type Draft = { garment: Garment; suggestedCategories: Category[] };

export const draftFromPhoto = async (file: Blob, examples: readonly LabelledEmbedding[]): Promise<Draft> => {
  const image = await downscale(file, STORED_PHOTO_SIZE);
  const { colors, ...derived } = await derive(image);
  const { categories, patterns } = await prompts();
  const ranked = rankCategories(derived.embedding, categories, examples);
  return {
    garment: {
      schema: GARMENT_SCHEMA,
      id: crypto.randomUUID(),
      image,
      name: "",
      description: "",
      brand: "",
      material: "",
      notes: "",
      category: ranked[0] ?? DEFAULT_CATEGORY,
      colors,
      pattern: suggestPattern(derived.embedding, patterns),
      occasions: [],
      bikeable: false,
      favourite: false,
      ...derived,
    },
    suggestedCategories: ranked.slice(0, 3),
  };
};

// Keeps the user's confirmed colors; only the derived fields are (re)computed.
export const completeGarment = async (garment: StoredGarment): Promise<Garment> => {
  if (isUpToDate(garment)) return garment;
  const { colors: _, ...derived } = await derive(garment.image);
  return { ...garment, ...derived };
};
