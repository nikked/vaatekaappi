import { RawImage } from "@huggingface/transformers";
import { cutoutColors } from "./color";
import {
  DEFAULT_CATEGORY,
  type Category,
  type Garment,
  type MaybeProcessedGarment,
  type Rgb,
} from "./garment";
import { cropRgba, loadPixels, opaqueBounds } from "./image";
import { embedCutout, prompts, segment } from "./models";
import { rankCategories, suggestPattern, type LabelledEmbedding } from "./suggest";

type Processed = { cutout: Blob; embedding: number[]; colors: Rgb[] };

// Cropped for display only: embeddings of the uncropped cut-out rank categories better.
const cropToGarment = (raw: RawImage): RawImage => {
  const bounds = opaqueBounds(raw.data, raw.width);
  return bounds ? new RawImage(cropRgba(raw.data, raw.width, bounds), bounds.width, bounds.height, 4) : raw;
};

const process = async (image: Blob): Promise<Processed> => {
  const raw = await segment(image);
  const cutout: unknown = await cropToGarment(raw).toBlob("image/png");
  if (!(cutout instanceof Blob)) throw new Error("Cut-out could not be encoded as PNG");
  return { cutout, embedding: await embedCutout(raw), colors: cutoutColors(await loadPixels(cutout)) };
};

export type Draft = { garment: Garment; suggestedCategories: Category[] };

export const draftFromPhoto = async (
  image: Blob,
  examples: readonly LabelledEmbedding[],
): Promise<Draft> => {
  const { cutout, embedding, colors } = await process(image);
  const { categories, patterns } = await prompts();
  const ranked = rankCategories(embedding, categories, examples);
  return {
    garment: {
      id: crypto.randomUUID(),
      name: "",
      description: "",
      image,
      cutout,
      embedding,
      category: ranked[0] ?? DEFAULT_CATEGORY,
      colors,
      pattern: suggestPattern(embedding, patterns),
      occasions: [],
      bikeable: false,
      favourite: false,
    },
    suggestedCategories: ranked.slice(0, 3),
  };
};

// Keeps the user's confirmed colors; only the cut-out and embedding are added.
export const completeGarment = async (garment: MaybeProcessedGarment): Promise<Garment> => {
  if (garment.cutout && garment.embedding) return { ...garment, cutout: garment.cutout, embedding: garment.embedding };
  const { cutout, embedding } = await process(garment.image);
  return { ...garment, cutout, embedding };
};
