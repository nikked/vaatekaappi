import { useState } from "react";
import { useObjectUrl } from "./useObjectUrl";
import {
  CATEGORIES,
  FORMALITIES,
  PATTERNS,
  SEASONS,
  isCategory,
  isOneOf,
  type Garment,
  type Rgb,
} from "./garment";

const rgbCss = ([r, g, b]: Rgb) => `rgb(${r} ${g} ${b})`;

type Props = {
  garment: Garment;
  submitLabel: string;
  onSubmit: (garment: Garment) => void;
  onCancel: () => void;
  onDelete?: () => void;
};

export const GarmentForm = ({ garment, submitLabel, onSubmit, onCancel, onDelete }: Props) => {
  const [draft, setDraft] = useState(garment);
  const imageUrl = useObjectUrl(garment.image);

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
          Category
          <select
            autoFocus
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

        <fieldset>
          <legend>Season</legend>
          {SEASONS.map((s) => (
            <label key={s}>
              <input
                type="checkbox"
                checked={draft.season.includes(s)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    season: e.target.checked
                      ? SEASONS.filter((x) => x === s || draft.season.includes(x))
                      : draft.season.filter((x) => x !== s),
                  })
                }
              />
              {s}
            </label>
          ))}
        </fieldset>

        <label>
          Formality
          <select
            value={draft.formality}
            onChange={(e) => {
              const formality = e.target.value;
              if (isOneOf(FORMALITIES)(formality)) setDraft({ ...draft, formality });
            }}
          >
            {FORMALITIES.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>

        <label>
          Pattern
          <select
            value={draft.pattern}
            onChange={(e) => {
              const pattern = e.target.value;
              if (isOneOf(PATTERNS)(pattern)) setDraft({ ...draft, pattern });
            }}
          >
            {PATTERNS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>

        <div className="colors">
          Colors
          {draft.colorsUncertain ? (
            <span> couldn't separate garment from background</span>
          ) : (
            draft.colors.map((c) => (
              <span key={rgbCss(c)} className="swatch" style={{ background: rgbCss(c) }} />
            ))
          )}
        </div>

        <div className="actions">
          <button type="submit">{submitLabel}</button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          {onDelete && (
            <button type="button" onClick={onDelete}>
              Delete
            </button>
          )}
        </div>
      </div>
    </form>
  );
};
