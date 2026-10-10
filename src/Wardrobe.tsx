import { useEffect, useState } from "react";
import { exportWardrobe, importWardrobe } from "./backup";
import { extractColors } from "./color";
import { deleteGarment, loadGarments, replaceGarments, saveGarment } from "./db";
import { GarmentForm } from "./GarmentForm";
import { loadPixels } from "./image";
import { useObjectUrl } from "./useObjectUrl";
import { DEFAULT_CATEGORY, type Garment } from "./garment";

const draftFromFile = async (file: File): Promise<Garment> => {
  const { colors, uncertain } = extractColors(await loadPixels(file));
  return {
    id: crypto.randomUUID(),
    image: file,
    category: DEFAULT_CATEGORY,
    colors,
    colorsUncertain: uncertain,
    season: [],
    formality: "casual",
    pattern: "solid",
  };
};

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
    <img src={useObjectUrl(garment.image)} alt={garment.category} />
    <span>{garment.category}</span>
  </button>
);

export const Wardrobe = () => {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [queue, setQueue] = useState<Garment[]>([]);
  const [editing, setEditing] = useState<Garment>();
  const [error, setError] = useState<string>();

  const reload = async () => setGarments(await loadGarments());

  useEffect(() => {
    void reload();
  }, []);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const drafts = await Promise.all([...files].map(draftFromFile));
    setQueue((q) => [...q, ...drafts]);
  };

  const save = async (garment: Garment) => {
    await saveGarment(garment);
    await reload();
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      await replaceGarments(await importWardrobe(await file.text()));
      setError(undefined);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const [next] = queue;

  return (
    <>
      <div className="toolbar">
        <label className="button">
          Add photos
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => void addFiles(e.target.files)}
          />
        </label>
        <button
          onClick={async () => download("wardrobe.json", await exportWardrobe(garments))}
          disabled={garments.length === 0}
        >
          Export
        </button>
        <label className="button">
          Import
          <input
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => void importFile(e.target.files?.[0])}
          />
        </label>
        {queue.length > 0 && <span>{queue.length} to review</span>}
      </div>
      {error && <p className="error">{error}</p>}

      {next ? (
        <GarmentForm
          key={next.id}
          garment={next}
          submitLabel="Save & next"
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
          submitLabel="Save"
          onSubmit={async (g) => {
            await save(g);
            setEditing(undefined);
          }}
          onCancel={() => setEditing(undefined)}
          onDelete={async () => {
            await deleteGarment(editing.id);
            setEditing(undefined);
            await reload();
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
