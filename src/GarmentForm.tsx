import { useState } from "react";
import { hexToRgb, rgbToHex } from "./color";
import { useObjectUrl } from "./useObjectUrl";
import {
  CATEGORIES,
  OCCASIONS,
  PATTERNS,
  WARMTHS,
  isCategory,
  isOneOf,
  type Category,
  type Garment,
  type Occasion,
  type Pattern,
  type Warmth,
} from "./garment";

const PATTERN_LABELS: Record<Pattern, string> = { solid: "Yksivärinen", patterned: "Kuviollinen" };
const OCCASION_LABELS: Record<Occasion, string> = { everyday: "Arki", party: "Juhla" };
const WARMTH_LABELS: Record<Warmth, string> = { warm: "Lämmin", cool: "Viileä" };
const MAX_COLORS = 2;

type Props = {
  garment: Garment;
  suggestedCategories?: readonly Category[];
  submitLabel: string;
  onSubmit: (garment: Garment) => void;
  onCancel: () => void;
  onDelete?: () => void;
};

export const GarmentForm = ({
  garment,
  suggestedCategories = [],
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: Props) => {
  const [draft, setDraft] = useState(garment);
  const imageUrl = useObjectUrl(garment.cutout);

  return (
    <form
      className="garment-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft);
      }}
    >
      <img src={imageUrl} alt="" />
      <div className="fields">
        <label>
          Nimi
          <input
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>

        <label>
          Kuvaus
          <input
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </label>

        {suggestedCategories.length > 0 && (
          <div className="suggestions">
            {suggestedCategories.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={draft.category === c}
                onClick={() => setDraft({ ...draft, category: c })}
              >
                {c.split(" > ").at(-1)}
              </button>
            ))}
          </div>
        )}

        <label>
          Kategoria
          <select
            value={draft.category}
            onChange={(e) => {
              const category = e.target.value;
              if (isCategory(category)) setDraft({ ...draft, category });
            }}
          >
            {Object.keys(CATEGORIES).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>

        <div className="colors">
          Värit
          {draft.colors.map((c, i) => (
            <span key={i}>
              <input
                type="color"
                value={rgbToHex(c)}
                onChange={(e) => {
                  const rgb = hexToRgb(e.target.value);
                  if (rgb) setDraft({ ...draft, colors: draft.colors.map((old, j) => (j === i ? rgb : old)) });
                }}
              />
              <button
                type="button"
                aria-label="Poista väri"
                onClick={() => setDraft({ ...draft, colors: draft.colors.filter((_, j) => j !== i) })}
              >
                ×
              </button>
            </span>
          ))}
          {draft.colors.length < MAX_COLORS && (
            <button
              type="button"
              onClick={() => setDraft({ ...draft, colors: [...draft.colors, [128, 128, 128]] })}
            >
              Lisää väri
            </button>
          )}
        </div>

        <label>
          Kuviointi
          <select
            value={draft.pattern}
            onChange={(e) => {
              const pattern = e.target.value;
              if (isOneOf(PATTERNS)(pattern)) setDraft({ ...draft, pattern });
            }}
          >
            {PATTERNS.map((p) => (
              <option key={p} value={p}>
                {PATTERN_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend>Tilanne</legend>
          {OCCASIONS.map((o) => (
            <label key={o}>
              <input
                type="checkbox"
                checked={draft.occasions.includes(o)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    occasions: e.target.checked
                      ? OCCASIONS.filter((x) => x === o || draft.occasions.includes(x))
                      : draft.occasions.filter((x) => x !== o),
                  })
                }
              />
              {OCCASION_LABELS[o]}
            </label>
          ))}
        </fieldset>

        <label>
          Lämpö
          <select
            value={draft.warmth ?? ""}
            onChange={(e) => {
              const warmth = e.target.value;
              const { warmth: _, ...rest } = draft;
              setDraft(isOneOf(WARMTHS)(warmth) ? { ...rest, warmth } : rest);
            }}
          >
            <option value="">–</option>
            {WARMTHS.map((w) => (
              <option key={w} value={w}>
                {WARMTH_LABELS[w]}
              </option>
            ))}
          </select>
        </label>

        {CATEGORIES[draft.category] === "bottom" && (
          <label>
            <input
              type="checkbox"
              checked={draft.bikeable}
              onChange={(e) => setDraft({ ...draft, bikeable: e.target.checked })}
            />
            Pyöräily
          </label>
        )}

        <label>
          <input
            type="checkbox"
            checked={draft.favourite}
            onChange={(e) => setDraft({ ...draft, favourite: e.target.checked })}
          />
          Lempivaate
        </label>

        <div className="actions">
          <button type="submit">{submitLabel}</button>
          <button type="button" onClick={onCancel}>
            Peruuta
          </button>
          {onDelete && (
            <button type="button" onClick={onDelete}>
              Poista
            </button>
          )}
        </div>
      </div>
    </form>
  );
};
