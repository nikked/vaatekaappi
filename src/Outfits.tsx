import { useEffect, useMemo, useState } from "react";
import { loadGarments } from "./db";
import { isProcessed, type Garment, type Occasion, type Slot, type Warmth } from "./garment";
import {
  SCORE_DOTS,
  fitsFilter,
  rankOutfits,
  scoreDots,
  scoreOutfit,
  slotOf,
  withSlot,
  type OutfitFilter,
} from "./outfit";
import { WARM_AUTUMN } from "./palette";
import { useObjectUrl } from "./useObjectUrl";

const OCCASIONS: readonly [Occasion, string][] = [
  ["everyday", "Arki"],
  ["party", "Juhla"],
];
const WEATHERS: readonly [Warmth, string][] = [
  ["warm", "Lämmin"],
  ["cool", "Viileä"],
];
const SLOT_ORDER: readonly Slot[] = ["outer", "top", "dress", "bottom"];
const SLOT_LABELS: Record<Slot, string> = { outer: "Takki", top: "Yläosa", dress: "Mekko", bottom: "Alaosa" };
const MAX_SHOWN = 20;

const bySlot = (outfit: readonly Garment[]): Garment[] =>
  [...outfit].sort(
    (a, b) => SLOT_ORDER.indexOf(slotOf(a) ?? "top") - SLOT_ORDER.indexOf(slotOf(b) ?? "top"),
  );

const CollageItem = ({ garment }: { garment: Garment }) => (
  <img className={`slot-${slotOf(garment)}`} src={useObjectUrl(garment.cutout)} alt={garment.name} />
);

const Collage = ({ outfit }: { outfit: readonly Garment[] }) => (
  <div className="collage">
    {bySlot(outfit).map((g) => (
      <CollageItem key={g.id} garment={g} />
    ))}
  </div>
);

const Dots = ({ count }: { count: number }) => (
  <span className="dots" aria-label={`${count} / ${SCORE_DOTS}`}>
    {"●".repeat(count)}
    {"○".repeat(SCORE_DOTS - count)}
  </span>
);

type Range = { best: number; worst: number };

const Editor = ({
  outfit,
  candidates,
  range,
  onChange,
  onClose,
}: {
  outfit: readonly Garment[];
  candidates: readonly Garment[];
  range: Range;
  onChange: (outfit: Garment[]) => void;
  onClose: () => void;
}) => {
  const slots = SLOT_ORDER.filter((slot) => slot === "outer" || outfit.some((g) => slotOf(g) === slot));
  const dots = scoreDots(scoreOutfit(outfit, WARM_AUTUMN), range.best, range.worst);
  return (
    <div className="outfit-editor">
      <Collage outfit={outfit} />
      <Dots count={dots} />
      {slots.map((slot) => (
        <label key={slot}>
          {SLOT_LABELS[slot]}
          <select
            value={outfit.find((g) => slotOf(g) === slot)?.id ?? ""}
            onChange={(e) => onChange(withSlot(outfit, slot, candidates.find((g) => g.id === e.target.value)))}
          >
            {slot === "outer" && <option value="">Ei takkia</option>}
            {candidates
              .filter((g) => slotOf(g) === slot)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </select>
        </label>
      ))}
      <button type="button" onClick={onClose}>
        Valmis
      </button>
    </div>
  );
};

export const Outfits = () => {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [filter, setFilter] = useState<OutfitFilter>({ occasion: "everyday", weather: "cool", cycling: false });
  const [editing, setEditing] = useState<Garment[]>();

  useEffect(() => {
    void loadGarments().then((stored) => setGarments(stored.filter(isProcessed)));
  }, []);

  const ranked = useMemo(() => rankOutfits(garments, filter), [garments, filter]);
  const byId = useMemo(() => new Map(garments.map((g) => [g.id, g])), [garments]);
  const candidates = useMemo(() => garments.filter((g) => fitsFilter(g, filter)), [garments, filter]);
  const range: Range = { best: ranked[0]?.score ?? 0, worst: ranked.at(-1)?.score ?? 0 };

  const update = (change: Partial<OutfitFilter>) => {
    setFilter({ ...filter, ...change });
    setEditing(undefined);
  };

  return (
    <>
      <h1>Mitä puen tänään?</h1>
      <div className="outfit-filters">
        <div className="segmented">
          {OCCASIONS.map(([value, label]) => (
            <button key={value} aria-pressed={filter.occasion === value} onClick={() => update({ occasion: value })}>
              {label}
            </button>
          ))}
        </div>
        <div className="segmented">
          {WEATHERS.map(([value, label]) => (
            <button key={value} aria-pressed={filter.weather === value} onClick={() => update({ weather: value })}>
              {label}
            </button>
          ))}
        </div>
        <label>
          <input type="checkbox" checked={filter.cycling} onChange={(e) => update({ cycling: e.target.checked })} />
          Pyöräily
        </label>
      </div>

      {editing && (
        <Editor
          outfit={editing}
          candidates={candidates}
          range={range}
          onChange={setEditing}
          onClose={() => setEditing(undefined)}
        />
      )}

      {ranked.length === 0 && <p>Ei sopivia asuja näillä valinnoilla.</p>}
      <div className="outfits">
        {ranked.slice(0, MAX_SHOWN).map((outfit, i) => {
          const items = outfit.garmentIds.flatMap((id) => byId.get(id) ?? []);
          return (
            <article key={outfit.garmentIds.join()} className="outfit-card">
              {i === 0 && <span className="badge">Sopii sinulle</span>}
              <Collage outfit={items} />
              <Dots count={scoreDots(outfit.score, range.best, range.worst)} />
              <p>{bySlot(items).map((g) => g.name).join(" · ")}</p>
              <button type="button" onClick={() => setEditing(items)}>
                Vaihda osa
              </button>
            </article>
          );
        })}
      </div>
    </>
  );
};
