import { useEffect, useRef, useState } from "react";
import { exportWardrobe, importWardrobe } from "./backup";
import { deleteGarment, loadGarments, replaceGarments, saveGarment } from "./db";
import { GarmentForm } from "./GarmentForm";
import { downscale } from "./image";
import { completeGarment, draftFromPhoto, type Draft } from "./photo";
import { useObjectUrl } from "./useObjectUrl";
import type { Garment, MaybeProcessedGarment } from "./garment";

const download = (filename: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const Thumbnail = ({ garment, onClick }: { garment: Garment; onClick: () => void }) => (
  <button className="thumb" onClick={onClick}>
    <img src={useObjectUrl(garment.cutout)} alt={garment.name} />
    <span>{garment.name}</span>
  </button>
);

// One at a time: the models share one GPU/CPU, so parallel runs aren't faster.
const completeAll = async (
  garments: readonly MaybeProcessedGarment[],
  onProgress: (done: number) => void,
): Promise<Garment[]> => {
  const completed: Garment[] = [];
  for (const g of garments) {
    completed.push(await completeGarment(g));
    onProgress(completed.length);
  }
  return completed;
};

export const Wardrobe = () => {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [queue, setQueue] = useState<Draft[]>([]);
  const [editing, setEditing] = useState<Garment>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const loadStarted = useRef(false);

  const showError = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  const process = async (stored: readonly MaybeProcessedGarment[]): Promise<Garment[]> => {
    const missing = stored.filter((g) => !g.cutout || !g.embedding).length;
    if (missing === 0) return completeAll(stored, () => {});
    setBusy(`Käsitellään vaatteita 0 / ${missing}…`);
    const done = await completeAll(stored, (n) => setBusy(`Käsitellään vaatteita ${n} / ${stored.length}…`));
    setBusy(undefined);
    return done;
  };

  useEffect(() => {
    if (loadStarted.current) return;
    loadStarted.current = true;
    void (async () => {
      try {
        const stored = await loadGarments();
        const complete = await process(stored);
        if (stored.some((g) => !g.cutout || !g.embedding)) await replaceGarments(complete);
        setGarments(complete);
      } catch (e) {
        showError(e);
      }
    })();
  }, []);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const examples = garments.map((g) => ({ embedding: g.embedding, category: g.category }));
    try {
      for (const [i, file] of [...files].entries()) {
        setBusy(`Tunnistetaan kuvaa ${i + 1} / ${files.length}…`);
        const draft = await draftFromPhoto(await downscale(file), examples);
        setQueue((q) => [...q, draft]);
      }
    } catch (e) {
      showError(e);
    } finally {
      setBusy(undefined);
    }
  };

  const save = async (garment: Garment) => {
    await saveGarment(garment);
    setGarments((gs) => [...gs.filter((g) => g.id !== garment.id), garment]);
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const complete = await process(await importWardrobe(await file.text()));
      await replaceGarments(complete);
      setGarments(complete);
      setError(undefined);
    } catch (e) {
      setBusy(undefined);
      showError(e);
    }
  };

  const [next] = queue;

  return (
    <>
      <div className="toolbar">
        <label className="button">
          Lisää kuvia
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => void addFiles(e.target.files)}
          />
        </label>
        <button
          onClick={async () => download("vaatekaappi.json", await exportWardrobe(garments))}
          disabled={garments.length === 0}
        >
          Vie
        </button>
        <label className="button">
          Tuo
          <input
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => void importFile(e.target.files?.[0])}
          />
        </label>
        {queue.length > 0 && <span>{queue.length} tarkistettavana</span>}
        {busy && <span className="busy">{busy}</span>}
      </div>
      {error && <p className="error">{error}</p>}

      {next ? (
        <GarmentForm
          key={next.garment.id}
          garment={next.garment}
          suggestedCategories={next.suggestedCategories}
          submitLabel="Tallenna & seuraava"
          onSubmit={async (g) => {
            await save(g);
            setQueue((q) => q.slice(1));
          }}
          onCancel={() => setQueue((q) => q.slice(1))}
        />
      ) : editing ? (
        <GarmentForm
          key={editing.id}
          garment={editing}
          submitLabel="Tallenna"
          onSubmit={async (g) => {
            await save(g);
            setEditing(undefined);
          }}
          onCancel={() => setEditing(undefined)}
          onDelete={async () => {
            await deleteGarment(editing.id);
            setGarments((gs) => gs.filter((g) => g.id !== editing.id));
            setEditing(undefined);
          }}
        />
      ) : null}

      <div className="grid">
        {garments.map((g) => (
          <Thumbnail key={g.id} garment={g} onClick={() => setEditing(g)} />
        ))}
      </div>
    </>
  );
};
