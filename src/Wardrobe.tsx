import { useEffect, useRef, useState } from "react";
import { exportWardrobe, importWardrobe } from "./backup";
import { deleteGarment, loadGarments, loadProfile, replaceGarments, saveGarment, saveProfile } from "./db";
import { GarmentForm, rgbCss, tintStyle } from "./GarmentForm";
import { Icon } from "./Icon";
import { completeGarment, draftFromPhoto, isUpToDate, type Draft } from "./photo";
import { useObjectUrl } from "./useObjectUrl";
import { categoryGroup, categoryLeaf, type Garment, type StoredGarment } from "./garment";

const download = (filename: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
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

const closeMenu = (inside: Element) => inside.closest("details")?.removeAttribute("open");

const matches = (g: Garment, filter: Filter): boolean =>
  filter === "all" ? true : filter === "favourites" ? g.favourite : categoryGroup(g.category) === filter;

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

  const showError = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

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
          setError(`${unreadable} vaatetta ei voitu lukea. Ne on jätetty tallennukseen koskemattomina.`);
        }
        await process(stored);
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
        const draft = await draftFromPhoto(file, examples);
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
    setGarments((gs) =>
      gs.some((g) => g.id === garment.id) ? gs.map((g) => (g.id === garment.id ? garment : g)) : [...gs, garment],
    );
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const backup = await importWardrobe(await file.text());
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
        <div className="review-top">
          <button className="btn btn-ghost" onClick={() => setReviewing(false)}>
            <Icon name="back" />
            Vaatekaappi
          </button>
          <div className="progress">
            <div className="progress-dots">
              {queue.map((d, i) => (
                <span key={d.garment.id} className={i === 0 ? "now" : undefined} />
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
        <div className="review-top">
          <button className="btn btn-ghost" onClick={() => setEditing(undefined)}>
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
          <input type="file" accept="image/*" multiple hidden onChange={(e) => void addFiles(e.target.files)} />
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
                download("vaatekaappi.json", await exportWardrobe(garments, await loadProfile()));
              }}
            >
              <Icon name="down" />
              <span>
                Vie varmuuskopio<small>Vaatteet ja värisi yhteen tiedostoon</small>
              </span>
            </button>
            <label>
              <Icon name="up" />
              <span>
                Tuo varmuuskopio<small>Korvaa nykyisen vaatekaapin ja värit</small>
              </span>
              <input
                type="file"
                accept="application/json"
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
              <span key={d.garment.id} style={{ background: rgbCss(d.garment.colors[0] ?? [200, 190, 180]) }} />
            ))}
          </div>
          <p>
            <strong>{queue.length === 1 ? "1 uusi kuva" : `${queue.length} uutta kuvaa`}</strong> odottaa
            tarkistusta.
          </p>
          <button className="btn btn-soft" onClick={() => setReviewing(true)}>
            Jatka tarkistusta
          </button>
        </div>
      )}

      <div className="filters">
        <button className="chip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          Kaikki <span className="count">{garments.length}</span>
        </button>
        {GROUPS.map(([label, group]) => (
          <button key={group} className="chip" aria-pressed={filter === group} onClick={() => setFilter(group)}>
            {label} <span className="count">{garments.filter((g) => matches(g, group)).length}</span>
          </button>
        ))}
        <button className="chip" aria-pressed={filter === "favourites"} onClick={() => setFilter("favourites")}>
          <Icon name="heart-fill" />
          Lempivaatteet
        </button>
      </div>

      {garments.length === 0 && !busy && <p className="empty">Lisää ensimmäiset vaatteet kuvista.</p>}
      <div className="grid">
        {shown.map((g) => (
          <Card
            key={g.id}
            garment={g}
            onOpen={() => setEditing(g)}
            onToggleFavourite={() => void save({ ...g, favourite: !g.favourite })}
          />
        ))}
      </div>
    </>
  );
};
