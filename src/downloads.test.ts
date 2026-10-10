import { describe, expect, it } from "vitest";
import { applyProgress, megabytes, totalProgress, type Downloads } from "./downloads";

const progress = (name: string, file: string, loaded: number, total: number) =>
  ({ status: "progress", name, file, progress: (loaded / total) * 100, loaded, total }) as const;

describe("applyProgress / totalProgress", () => {
  it("sums the latest progress of every file of every model", () => {
    const events = [
      progress("rmbg", "model.onnx", 10, 100),
      progress("siglip", "vision.onnx", 50, 200),
      progress("rmbg", "model.onnx", 60, 100),
    ];
    const downloads = events.reduce<Downloads>(applyProgress, new Map());
    expect(totalProgress(downloads)).toEqual({ loaded: 110, total: 300 });
  });

  it("ignores events without byte counts", () => {
    const start: Downloads = new Map([["rmbg/model.onnx", { loaded: 1, total: 2 }]]);
    expect(applyProgress(start, { status: "done", name: "rmbg", file: "model.onnx" })).toBe(start);
  });

  it("is zero before anything downloads", () => {
    expect(totalProgress(new Map())).toEqual({ loaded: 0, total: 0 });
  });
});

describe("megabytes", () => {
  it("rounds to whole megabytes", () => {
    expect(megabytes(249_600_000)).toBe("250 Mt");
  });
});
