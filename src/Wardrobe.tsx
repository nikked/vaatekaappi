import { useEffect, useRef, useState } from "react";
import { exportBackup, importBackup } from "./backup";
import {
  deleteGarment,
  loadGarments,
  loadProfile,
  replaceGarments,
  saveGarment,
  saveProfile,
} from "./db";
import { GarmentForm, rgbCss, tintStyle } from "./GarmentForm";
import {
  categoryGroup,
  categoryLeaf,
  type Garment,
  type StoredGarment,
} from "./garment";
import { Icon } from "./Icon";
import { imageFiles } from "./image";
import {
  completeGarment,
  type Draft,
  draftFromPhoto,
  isUpToDate,
} from "./photo";
import { useObjectUrl } from "./useObjectUrl";

const download = (filename: string, content: Blob) => {
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// Top-level categories as filter chips; the rest only show under "Kaikki".
const GROUPS = [
  ["Yläosat", "Yläosa"],
  ["Alaosat", "Alaosa"],
  ["Päällysosat", "Päällysosat"],
  ["Takit", "Takit"],
  ["Mekot", "Mekot"],
] as const;
type Filter = "all" | "favourites" | (typeof GROUPS)[number][1];

const closeMenu = (inside: Element) =>
  inside.closest("details")?.removeAttribute("open");

const matches = (g: Garment, filter: Filter): boolean =>
  filter === "all"
    ? true
    : filter === "favourites"
      ? g.favourite
      : categoryGroup(g.category) === filter;

const Card = ({
  garment,
  onOpen,
  onToggleFavourite,
}: {
  garment: Garment;
  onOpen: () => void;
  onToggleFavourite: () => void;
}) => (
  <article className="card" onClick={onOpen}>
    <div className="photo" style={tintStyle(garment.colors)}>
      <img src={useObjectUrl(garment.cutout)} alt={garment.name} />
      <button
        className="heart"
        aria-pressed={garment.favourite}
        title="Lempivaate"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavourite();
        }}
      >
        <Icon name={garment.favourite ? "heart-fill" : "heart"} />
      </button>
    </div>
    <div className="card-meta">
      <span className="name">{garment.name || "Nimetön"}</span>
      <span className="dots">
        {garment.colors.map((c, i) => (
          <span key={i} className="dot" style={{ background: rgbCss(c) }} />
        ))}
      </span>
    </div>
    <p className="card-sub">{categoryLeaf(garment.category)}</p>
  </article>
);

// One at a time, each saved as soon as it's done: the models share one GPU/CPU,
// and a closed tab or failed download loses at most the garment in progress.
const completeAll = async (
  stored: readonly StoredGarment[],
  onProgress: (done: number, total: number) => void,
): Promise<Garment[]> => {
  const total = stored.filter((g) => !isUpToDate(g)).length;
  let done = 0;
  const completed: Garment[] = [];
  for (const g of stored) {
    if (isUpToDate(g)) {
      completed.push(g);
      continue;
    }
    onProgress(done, total);
    const garment = await completeGarment(g);
    await saveGarment(garment);
    completed.push(garment);
    done += 1;
  }
  return completed;
};

export const Wardrobe = () => {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [queue, setQueue] = useState<Draft[]>([]);
  const [editing, setEditing] = useState<Garment>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [reviewing, setReviewing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const loadStarted = useRef(false);

  const showError = (e: unknown) =>
    setError(e instanceof Error ? e.message : String(e));

  const process = async (stored: readonly StoredGarment[]): Promise<void> => {
    setGarments(stored.filter(isUpToDate));
    const complete = await completeAll(stored, (done, total) =>
      setBusy(`Käsitellään kuvia ${done + 1} / ${total}…`),
    );
    setBusy(undefined);
    setGarments(complete);
  };

  useEffect(() => {
    if (loadStarted.current) return;
    loadStarted.current = true;
    void (async () => {
      try {
        const { garments: stored, unreadable } = await loadGarments();
        if (unreadable > 0) {
          setError(
            `${unreadable} vaatetta ei voitu lukea. Ne on jätetty tallennukseen koskemattomina.`,
          );
        }
        await process(stored);
      } catch (e) {
        showError(e);
      }
    })();
  }, []);

  // One queue for all added photos: drops while photos are still processing
  // join the same run instead of starting a second loop that competes for the
  // models and overwrites the counter. Refs because the run outlives renders.
  const pending = useRef<File[]>([]);
  const progress = useRef<{ done: number; total: number; failed: string[] }>({
    done: 0,
    total: 0,
    failed: [],
  });
  const running = useRef(false);
  const garmentsRef = useRef(garments);
  garmentsRef.current = garments;

  const drain = async () => {
    running.current = true;
    for (
      let file = pending.current.shift();
      file;
      file = pending.current.shift()
    ) {
      const { done, total } = progress.current;
      setBusy(`Tunnistetaan kuvaa ${done + 1} / ${total}…`);
      const examples = garmentsRef.current.map((g) => ({
        embedding: g.embedding,
        category: g.category,
      }));
      try {
        const draft = await draftFromPhoto(file, examples);
        setQueue((q) => [...q, draft]);
      } catch {
        // Typically HEIC outside Safari; the rest of the photos still go through.
        progress.current.failed.push(file.name);
      }
      progress.current.done += 1;
    }
    const { failed } = progress.current;
    progress.current = { done: 0, total: 0, failed: [] };
    running.current = false;
    setBusy(undefined);
    if (failed.length > 0) {
      setError(
        `Näitä kuvia ei saatu käsiteltyä: ${failed.join(", ")}. Jos ne ovat HEIC-kuvia, tallenna ne ` +
          "JPEG-muodossa (Kuvat-apissa Arkisto → Vie) tai käytä Safaria.",
      );
    }
  };

  const addFiles = (picked: readonly File[]) => {
    const files = imageFiles(picked);
    if (files.length === 0) return;
    pending.current.push(...files);
    progress.current.total += files.length;
    if (running.current) {
      setBusy(
        `Tunnistetaan kuvaa ${progress.current.done + 1} / ${progress.current.total}…`,
      );
    } else {
      void drain();
    }
  };

  // The whole screen accepts photos dragged from Finder or Photos.
  const addFilesRef = useRef(addFiles);
  addFilesRef.current = addFiles;
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) =>
      e.dataTransfer?.types.includes("Files") ?? false;
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    // Without preventDefault the browser opens the dropped file instead.
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      addFilesRef.current([...(e.dataTransfer?.files ?? [])]);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);
  const dropOverlay = dragging && (
    <div className="drop-overlay">
      <Icon name="plus" />
      Pudota kuvat tähän
    </div>
  );

  const save = async (garment: Garment) => {
    await saveGarment(garment);
    setGarments((gs) =>
      gs.some((g) => g.id === garment.id)
        ? gs.map((g) => (g.id === garment.id ? garment : g))
        : [...gs, garment],
    );
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const backup = await importBackup(
        new Uint8Array(await file.arrayBuffer()),
      );
      // Stored before any processing, so the imported input is safe even if models fail.
      await replaceGarments(backup.garments);
      if (backup.profile) await saveProfile(backup.profile);
      setError(undefined);
      await process(backup.garments);
    } catch (e) {
      setBusy(undefined);
      showError(e);
    }
  };

  const [next] = queue;

  if (reviewing && next) {
    return (
      <>
        {dropOverlay}
        <div className="review-top">
          <button className="btn btn-ghost" onClick={() => setReviewing(false)}>
            <Icon name="back" />
            Vaatekaappi
          </button>
          <div className="progress">
            <div className="progress-dots">
              {queue.map((d, i) => (
                <span
                  key={d.garment.id}
                  className={i === 0 ? "now" : undefined}
                />
              ))}
            </div>
            {queue.length} jäljellä
          </div>
        </div>
        <GarmentForm
          key={next.garment.id}
          garment={next.garment}
          suggestedCategories={next.suggestedCategories}
          queue={queue.map((d) => d.garment)}
          submitLabel="Tallenna & seuraava"
          cancelLabel="Ohita"
          onSubmit={async (g) => {
            await save(g);
            setQueue((q) => q.slice(1));
          }}
          onCancel={() => setQueue((q) => q.slice(1))}
        />
      </>
    );
  }

  if (editing) {
    return (
      <>
        {dropOverlay}
        <div className="review-top">
          <button
            className="btn btn-ghost"
            onClick={() => setEditing(undefined)}
          >
            <Icon name="back" />
            Vaatekaappi
          </button>
        </div>
        <GarmentForm
          key={editing.id}
          garment={editing}
          submitLabel="Tallenna"
          cancelLabel="Peruuta"
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
      </>
    );
  }

  const favourites = garments.filter((g) => g.favourite).length;
  const shown = garments.filter((g) => matches(g, filter));

  return (
    <>
      {dropOverlay}
      <div className="screen-head">
        <div className="grow">
          <h1>Vaatekaappi</h1>
          <p>
            {garments.length} vaatetta · {favourites} lempivaatetta
          </p>
        </div>
        <label className="btn btn-primary" title="Lisää kuvia">
          <Icon name="plus" />
          <span className="add-label">Lisää kuvia</span>
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => addFiles([...(e.target.files ?? [])])}
          />
        </label>
        <details className="menu">
          <summary className="icon-btn" title="Lisää toimintoja">
            <Icon name="more" />
          </summary>
          <div className="menu-panel">
            <button
              disabled={garments.length === 0}
              onClick={async (e) => {
                closeMenu(e.currentTarget);
                // From the database, not the screen: includes garments still waiting for a cut-out.
                const zip = await exportBackup(
                  (await loadGarments()).garments,
                  await loadProfile(),
                );
                const date = new Date().toISOString().slice(0, 10);
                download(
                  `kaappi-varmuuskopio-${date}.zip`,
                  new Blob([new Uint8Array(zip)], { type: "application/zip" }),
                );
              }}
            >
              <Icon name="down" />
              <span>
                Vie varmuuskopio
                <small>Kuvat, vaatteiden tiedot ja värisi zip-tiedostoon</small>
              </span>
            </button>
            <label>
              <Icon name="up" />
              <span>
                Tuo varmuuskopio
                <small>Korvaa nykyisen vaatekaapin ja värit</small>
              </span>
              <input
                type="file"
                accept=".zip,.json,application/zip,application/json"
                hidden
                onChange={(e) => {
                  closeMenu(e.currentTarget);
                  void importFile(e.target.files?.[0]);
                }}
              />
            </label>
          </div>
        </details>
      </div>

      {error && <p className="error">{error}</p>}
      {busy && (
        <div className="notice">
          <p>{busy}</p>
        </div>
      )}
      {queue.length > 0 && (
        <div className="notice">
          <div className="stack">
            {queue.slice(0, 3).map((d) => (
              <span
                key={d.garment.id}
                style={{
                  background: rgbCss(d.garment.colors[0] ?? [200, 190, 180]),
                }}
              />
            ))}
          </div>
          <p>
            <strong>
              {queue.length === 1
                ? "1 uusi kuva"
                : `${queue.length} uutta kuvaa`}
            </strong>{" "}
            odottaa tarkistusta.
          </p>
          <button className="btn btn-soft" onClick={() => setReviewing(true)}>
            Jatka tarkistusta
          </button>
        </div>
      )}

      <div className="filters">
        <button
          className="chip"
          aria-pressed={filter === "all"}
          onClick={() => setFilter("all")}
        >
          Kaikki <span className="count">{garments.length}</span>
        </button>
        {GROUPS.map(([label, group]) => (
          <button
            key={group}
            className="chip"
            aria-pressed={filter === group}
            onClick={() => setFilter(group)}
          >
            {label}{" "}
            <span className="count">
              {garments.filter((g) => matches(g, group)).length}
            </span>
          </button>
        ))}
        <button
          className="chip"
          aria-pressed={filter === "favourites"}
          onClick={() => setFilter("favourites")}
        >
          <Icon name="heart-fill" />
          Lempivaatteet
        </button>
      </div>

      {garments.length === 0 && !busy && (
        <p className="empty">Lisää ensimmäiset vaatteet kuvista.</p>
      )}
      <div className="grid">
        {shown.map((g) => (
          <Card
            key={g.id}
            garment={g}
            onOpen={() => setEditing(g)}
            onToggleFavourite={() =>
              void save({ ...g, favourite: !g.favourite })
            }
          />
        ))}
      </div>
    </>
  );
};
