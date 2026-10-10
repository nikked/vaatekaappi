import { useEffect, useMemo, useState, type ReactNode } from "react";
import { loadGarments } from "./db";
import { isProcessed, type Garment, type Occasion, type Slot, type Warmth } from "./garment";
import { rgbCss } from "./GarmentForm";
import { Icon, type IconName } from "./Icon";
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
const WEATHERS: readonly [Warmth, string, IconName][] = [
  ["warm", "Lämmin", "sun"],
  ["cool", "Viileä", "leaf"],
];
const SLOT_ORDER: readonly Slot[] = ["outer", "top", "dress", "bottom"];
const SLOT_LABELS: Record<Slot, string> = { outer: "Päällysosa tai takki", top: "Yläosa", dress: "Mekko", bottom: "Alaosa" };
const MAX_SHOWN = 20;

const bySlot = (outfit: readonly Garment[]): Garment[] =>
  [...outfit].sort((a, b) => SLOT_ORDER.indexOf(slotOf(a) ?? "top") - SLOT_ORDER.indexOf(slotOf(b) ?? "top"));

const CollageItem = ({ garment }: { garment: Garment }) => (
  <img className={slotOf(garment) ?? undefined} src={useObjectUrl(garment.cutout)} alt={garment.name} />
);

const Collage = ({ outfit, children }: { outfit: readonly Garment[]; children?: ReactNode }) => (
  <div className={outfit.some((g) => slotOf(g) === "outer") ? "collage" : "collage no-outer"}>
    {bySlot(outfit).map((g) => (
      <CollageItem key={g.id} garment={g} />
    ))}
    {children}
  </div>
);

const Score = ({ dots }: { dots: number }) => (
  <span className="score" title={`${dots} / ${SCORE_DOTS}`}>
    {Array.from({ length: SCORE_DOTS }, (_, i) => (
      <span key={i} className={i < dots ? "on" : undefined} />
    ))}
  </span>
);

const Items = ({ outfit }: { outfit: readonly Garment[] }) => (
  <ul className="outfit-items">
    {bySlot(outfit).map((g) => (
      <li key={g.id}>
        {g.colors[0] && <span className="dot" style={{ background: rgbCss(g.colors[0]) }} />}
        {g.name}
      </li>
    ))}
  </ul>
);

const SwapFields = ({
  outfit,
  candidates,
  onChange,
}: {
  outfit: readonly Garment[];
  candidates: readonly Garment[];
  onChange: (outfit: Garment[]) => void;
}) => (
  <div className="swap">
    {SLOT_ORDER.filter((slot) => slot === "outer" || outfit.some((g) => slotOf(g) === slot)).map((slot) => (
      <label key={slot}>
        {SLOT_LABELS[slot]}
        <select
          className="select-input"
          value={outfit.find((g) => slotOf(g) === slot)?.id ?? ""}
          onChange={(e) => onChange(withSlot(outfit, slot, candidates.find((g) => g.id === e.target.value)))}
        >
          {slot === "outer" && <option value="">Ei mitään</option>}
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
  </div>
);

type Editing = { key: string; outfit: Garment[] };

export const Outfits = () => {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [filter, setFilter] = useState<OutfitFilter>({ occasion: "everyday", weather: "cool", cycling: false });
  const [editing, setEditing] = useState<Editing>();

  useEffect(() => {
    void loadGarments().then((stored) => setGarments(stored.filter(isProcessed)));
  }, []);

  const ranked = useMemo(() => rankOutfits(garments, filter), [garments, filter]);
  const byId = useMemo(() => new Map(garments.map((g) => [g.id, g])), [garments]);
  const candidates = useMemo(() => garments.filter((g) => fitsFilter(g, filter)), [garments, filter]);
  const best = ranked[0]?.score ?? 0;
  const worst = ranked.at(-1)?.score ?? 0;

  const update = (change: Partial<OutfitFilter>) => {
    setFilter({ ...filter, ...change });
    setEditing(undefined);
  };

  return (
    <>
      <div className="screen-head">
        <div className="grow">
          <h1>Mitä puen tänään?</h1>
          <p>Asut lämpimän syksyn värien mukaan, parhaat ensin.</p>
        </div>
      </div>

      <div className="pickers">
        <div className="picker">
          <span className="picker-label">Tilanne</span>
          <div className="segmented">
            {OCCASIONS.map(([value, label]) => (
              <button key={value} aria-pressed={filter.occasion === value} onClick={() => update({ occasion: value })}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="picker">
          <span className="picker-label">Sää</span>
          <div className="segmented">
            {WEATHERS.map(([value, label, icon]) => (
              <button key={value} aria-pressed={filter.weather === value} onClick={() => update({ weather: value })}>
                <Icon name={icon} />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="picker">
          <button className="switch" aria-pressed={filter.cycling} onClick={() => update({ cycling: !filter.cycling })}>
            <Icon name="bike" />
            Pyöräily
            <span className="track" />
          </button>
        </div>
      </div>

      {ranked.length === 0 && <p className="empty">Ei sopivia asuja näillä valinnoilla.</p>}
      <div className="outfits">
        {ranked.slice(0, MAX_SHOWN).map((entry, i) => {
          const key = entry.garmentIds.join();
          const isEditing = editing?.key === key;
          const outfit = isEditing ? editing.outfit : entry.garmentIds.flatMap((id) => byId.get(id) ?? []);
          const score = isEditing ? scoreOutfit(outfit, WARM_AUTUMN) : entry.score;
          return (
            <article key={key} className={["outfit", i === 0 && "best", isEditing && "editing"].filter(Boolean).join(" ")}>
              <Collage outfit={outfit}>
                {i === 0 && !isEditing && (
                  <span className="badge">
                    <Icon name="sparkle" />
                    Sopii sinulle
                  </span>
                )}
              </Collage>
              <div className="outfit-body">
                <div className="outfit-head">
                  <Items outfit={outfit} />
                  <Score dots={scoreDots(score, best, worst)} />
                </div>
                {isEditing && (
                  <SwapFields
                    outfit={outfit}
                    candidates={candidates}
                    onChange={(changed) => setEditing({ key, outfit: changed })}
                  />
                )}
                <div className="outfit-actions">
                  {isEditing ? (
                    <button className="btn btn-soft" onClick={() => setEditing(undefined)}>
                      Valmis
                    </button>
                  ) : (
                    <button className="btn btn-soft" onClick={() => setEditing({ key, outfit })}>
                      <Icon name="shuffle" />
                      Vaihda osa
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
};
