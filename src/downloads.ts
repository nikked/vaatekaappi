import type { ProgressInfo } from "@huggingface/transformers";

export type Downloads = ReadonlyMap<string, { loaded: number; total: number }>;

// Each model is several files reported separately; keyed by model and file.
export const applyProgress = (downloads: Downloads, info: ProgressInfo): Downloads =>
  info.status === "progress"
    ? new Map(downloads).set(`${info.name}/${info.file}`, { loaded: info.loaded, total: info.total })
    : downloads;

export const totalProgress = (downloads: Downloads): { loaded: number; total: number } =>
  [...downloads.values()].reduce((sum, f) => ({ loaded: sum.loaded + f.loaded, total: sum.total + f.total }), {
    loaded: 0,
    total: 0,
  });

export const megabytes = (bytes: number): string => `${Math.round(bytes / 1_000_000)} Mt`;
