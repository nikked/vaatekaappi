import { loadGarments } from "./db";
import { imageFiles } from "./image";
import { type Draft, draftFromPhoto, isUpToDate } from "./photo";

// Photo recognition runs here, outside React, so it keeps going while the user
// is on another screen. Screens subscribe for drafts and progress.
export type ImportState = {
  drafts: readonly Draft[]; // recognised, waiting for review
  done: number; // of the current run
  total: number;
  failed: readonly string[]; // file names, until the user dismisses them
};

let state: ImportState = { drafts: [], done: 0, total: 0, failed: [] };
const listeners = new Set<() => void>();

const update = (change: Partial<ImportState>) => {
  state = { ...state, ...change };
  for (const listener of listeners) listener();
};

export const subscribeImports = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getImports = (): ImportState => state;

const pending: File[] = [];
let running = false;

// Read per photo, so garments saved from the review queue meanwhile count too.
const examples = async () =>
  (await loadGarments()).garments
    .filter(isUpToDate)
    .map((g) => ({ embedding: g.embedding, category: g.category }));

// One run for all added photos: photos added during a run join it, so two
// loops never compete for the models.
const drain = async () => {
  running = true;
  for (let file = pending.shift(); file; file = pending.shift()) {
    try {
      const draft = await draftFromPhoto(file, await examples());
      update({ drafts: [...state.drafts, draft], done: state.done + 1 });
    } catch {
      // Typically HEIC outside Safari; the rest of the photos still go through.
      update({ failed: [...state.failed, file.name], done: state.done + 1 });
    }
  }
  running = false;
  update({ done: 0, total: 0 });
};

export const addPhotos = (picked: readonly File[]) => {
  const files = imageFiles(picked);
  if (files.length === 0) return;
  pending.push(...files);
  update({ total: state.total + files.length });
  if (!running) void drain();
};

export const removeDraft = (id: string) =>
  update({ drafts: state.drafts.filter((d) => d.garment.id !== id) });

export const dismissFailed = () => update({ failed: [] });
