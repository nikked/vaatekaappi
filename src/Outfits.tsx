import { type ReactNode, useEffect, useMemo, useState } from "react";
import { loadGarments, loadProfile } from "./db";
import { rgbCss } from "./GarmentForm";
import {
  categoryGroup,
  type Garment,
  type Occasion,
  type Slot,
} from "./garment";
import { Icon } from "./Icon";
import {
  type Cycling,
  fitsFilter,
  type OutfitFilter,
  rankOutfits,
  SCORE_DOTS,
  scoreDots,
  scoreOutfit,
  slotOf,
  withSlot,
} from "./outfit";
import { DEFAULT_PROFILE, SEASON_LABELS } from "./palette";
import { isUpToDate } from "./photo";
import { useObjectUrl } from "./useObjectUrl";

const OCCASIONS: readonly [Occasion, string][] = [
  ["everyday", "Arki"],
  ["party", "Juhla"],
];
const CYCLING: readonly [Cycling, string][] = [
  ["any", "Kaikki"],
  ["bikeable", "Pyöräilyyn"],
  ["unbikeable", "Ei pyöräilyyn"],
];
const SLOT_ORDER: readonly Slot[] = ["outer", "top", "dress", "bottom"];
const SLOT_LABELS: Record<Slot, string> = {
  outer: "Päällysosa tai takki",
  top: "Yläosa",
  dress: "Mekko",
  bottom: "Alaosa",
};
const MAX_SHOWN = 20;

const bySlot = (outfit: readonly Garment[]): Garment[] =>
  [...outfit].sort(
    (a, b) =>
      SLOT_ORDER.indexOf(slotOf(a) ?? "top") -
      SLOT_ORDER.indexOf(slotOf(b) ?? "top"),
  );

const CollageItem = ({ garment }: { garment: Garment }) => (
  <img
    className={slotOf(garment) ?? undefined}
    src={useObjectUrl(garment.cutout)}
    alt={garment.name}
  />
);

const Collage = ({
  outfit,
  children,
}: {
  outfit: readonly Garment[];
  children?: ReactNode;
}) => (
  <div
    className={
      outfit.some((g) => slotOf(g) === "outer") ? "collage" : "collage no-outer"
    }
  >
    {bySlot(outfit).map((g) => (
      <CollageItem key={g.id} garment={g} />
    ))}
    {children}
  </div>
);

const Score = ({ dots }: { dots: number }) => (
  <span className="score" title={`${dots} / ${SCORE_DOTS}`}>
    <span className="score-label">Sopivuus</span>
    <span className="score-dots">
      {Array.from({ length: SCORE_DOTS }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed row of five dots
        <span key={i} className={i < dots ? "on" : undefined} />
      ))}
    </span>
  </span>
);

const Items = ({ outfit }: { outfit: readonly Garment[] }) => (
  <ul className="outfit-items">
    {bySlot(outfit).map((g) => (
      <li key={g.id}>
        {g.colors[0] && (
          <span className="dot" style={{ background: rgbCss(g.colors[0]) }} />
        )}
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
    {SLOT_ORDER.filter(
      (slot) => slot === "outer" || outfit.some((g) => slotOf(g) === slot),
    ).map((slot) => (
      <label key={slot}>
        {SLOT_LABELS[slot]}
        <select
          className="select-input"
          value={outfit.find((g) => slotOf(g) === slot)?.id ?? ""}
          onChange={(e) =>
            onChange(
              withSlot(
                outfit,
                slot,
                candidates.find((g) => g.id === e.target.value),
              ),
            )
          }
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

// Only garments that can be part of an outfit, grouped like the wardrobe filters.
const groupedForPicker = (
  garments: readonly Garment[],
): [string, Garment[]][] => {
  const groups = new Map<string, Garment[]>();
  for (const g of garments.filter((g) => slotOf(g) !== null)) {
    const group = categoryGroup(g.category);
    groups.set(group, [...(groups.get(group) ?? []), g]);
  }
  return [...groups];
};

type Editing = { key: string; outfit: Garment[] };

export const Outfits = () => {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [filter, setFilter] = useState<OutfitFilter>({
    occasion: "everyday",
    cycling: "any",
  });
  const [editing, setEditing] = useState<Editing>();
  const [profile, setProfile] = useState(DEFAULT_PROFILE);

  useEffect(() => {
    void loadGarments().then(({ garments: stored }) =>
      setGarments(stored.filter(isUpToDate)),
    );
    void loadProfile().then(setProfile);
  }, []);

  const ranked = useMemo(
    () => rankOutfits(garments, filter, profile.palette),
    [garments, filter, profile],
  );
  const byId = useMemo(
    () => new Map(garments.map((g) => [g.id, g])),
    [garments],
  );
  const candidates = useMemo(
    () => garments.filter((g) => fitsFilter(g, filter)),
    [garments, filter],
  );
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
          <h1>Mitä mä laitan päälle?</h1>
          <p>
            Asut värityyppisi ({SEASON_LABELS[profile.season].toLowerCase()})
            mukaan, parhaat ensin.
          </p>
          {ranked.length > 0 && (
            <p className="outfit-count">
              {ranked.length > MAX_SHOWN
                ? `${ranked.length} asua, näytetään ${MAX_SHOWN} parasta`
                : `${ranked.length} ${ranked.length === 1 ? "asu" : "asua"}`}
            </p>
          )}
        </div>
      </div>

      <div className="pickers">
        <div className="picker">
          <span className="picker-label">Vaate</span>
          <select
            className="select-input garment-picker"
            value={filter.garmentId ?? ""}
            onChange={(e) => update({ garmentId: e.target.value || undefined })}
          >
            <option value="">Kaikki vaatteet</option>
            {groupedForPicker(garments).map(([group, items]) => (
              <optgroup key={group} label={group}>
                {items.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name || "Nimetön"}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="picker">
          <span className="picker-label">Tilanne</span>
          <div className="segmented">
            {OCCASIONS.map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={filter.occasion === value}
                onClick={() => update({ occasion: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="picker">
          <span className="picker-label">
            <Icon name="bike" />
            Pyöräily
          </span>
          <div className="segmented">
            {CYCLING.map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={filter.cycling === value}
                onClick={() => update({ cycling: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {ranked.length === 0 && (
        <p className="empty">Ei sopivia asuja näillä valinnoilla.</p>
      )}
      <div className="outfits">
        {ranked.slice(0, MAX_SHOWN).map((entry, i) => {
          const key = entry.garmentIds.join();
          const isEditing = editing?.key === key;
          const outfit = isEditing
            ? editing.outfit
            : entry.garmentIds.flatMap((id) => byId.get(id) ?? []);
          const score = isEditing
            ? scoreOutfit(outfit, profile.palette)
            : entry.score;
          return (
            <article
              key={key}
              className={["outfit", i === 0 && "best", isEditing && "editing"]
                .filter(Boolean)
                .join(" ")}
            >
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
                    <button
                      type="button"
                      className="btn btn-soft"
                      onClick={() => setEditing(undefined)}
                    >
                      Valmis
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-soft"
                      onClick={() => setEditing({ key, outfit })}
                    >
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
