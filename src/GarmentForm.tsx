import { useState, type CSSProperties } from "react";
import { hexToRgb, rgbToHex } from "./color";
import { Icon } from "./Icon";
import { useObjectUrl } from "./useObjectUrl";
import {
  CATEGORIES,
  categoryLabel,
  categoryLeaf,
  isCategory,
  type Category,
  type Garment,
  type Occasion,
  type Rgb,
} from "./garment";

const MAX_COLORS = 2;
// Grey start for a new color: the user picks the real one right after adding.
const NEW_COLOR: Rgb = [128, 128, 128];

export const rgbCss = ([r, g, b]: Rgb) => `rgb(${r} ${g} ${b})`;
// Suggestions only: material is free text so unusual fabrics can be entered.
const MATERIALS = ["puuvilla", "villa", "farkku", "pellava", "viskoosi", "polyesteri", "silkki", "nahka", "neule"];

// Card and photo backgrounds are tinted with the garment's main color.
export const tintStyle = (colors: readonly Rgb[]): CSSProperties & { "--tint"?: string } =>
  colors[0] ? { "--tint": rgbCss(colors[0]) } : {};

const toggled = <T,>(values: readonly T[], value: T, order: readonly T[]): T[] =>
  order.filter((v) => (v === value ? !values.includes(v) : values.includes(v)));

type Props = {
  garment: Garment;
  suggestedCategories?: readonly Category[];
  queue?: readonly Garment[];
  submitLabel: string;
  cancelLabel: string;
  onSubmit: (garment: Garment) => void;
  onCancel: () => void;
  onDelete?: () => void;
};

const QueueThumb = ({ garment, now }: { garment: Garment; now: boolean }) => (
  <span className={now ? "now" : undefined} style={tintStyle(garment.colors)}>
    <img src={useObjectUrl(garment.cutout)} alt="" />
  </span>
);

const Toggle = ({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) => (
  <button type="button" className="chip toggle" aria-pressed={on} onClick={onClick}>
    {label}
  </button>
);

export const GarmentForm = ({
  garment,
  suggestedCategories = [],
  queue = [],
  submitLabel,
  cancelLabel,
  onSubmit,
  onCancel,
  onDelete,
}: Props) => {
  const [draft, setDraft] = useState(garment);
  const [pickCategory, setPickCategory] = useState(suggestedCategories.length === 0);
  const imageUrl = useObjectUrl(garment.cutout);

  const toggleOccasion = (o: Occasion) =>
    setDraft({ ...draft, occasions: toggled(draft.occasions, o, ["everyday", "party"]) });

  const toggleWarmth = (w: "warm" | "cool") => {
    const { warmth: _, ...rest } = draft;
    setDraft(draft.warmth === w ? rest : { ...rest, warmth: w });
  };

  return (
    <form
      className="review"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft);
      }}
    >
      <div>
        <div className="photo" style={tintStyle(draft.colors)}>
          <img src={imageUrl} alt="" />
        </div>
        {queue.length > 1 && (
          <div className="queue">
            {queue.map((g, i) => (
              <QueueThumb key={g.id} garment={g} now={i === 0} />
            ))}
          </div>
        )}
      </div>

      <div className="fields">
        <div>
          <div className="field-label">Nimi</div>
          <input
            className="text-input"
            autoFocus
            value={draft.name}
            placeholder="esim. Liila neulepaita"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>

        <div>
          <div className="field-label">
            Kategoria {suggestedCategories.length > 0 && <small>ehdotukset kuvan perusteella</small>}
          </div>
          {suggestedCategories.length > 0 && (
            <div className="suggest">
              {suggestedCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="chip"
                  aria-pressed={!pickCategory && draft.category === c}
                  onClick={() => {
                    setPickCategory(false);
                    setDraft({ ...draft, category: c });
                  }}
                >
                  {categoryLeaf(c)}
                </button>
              ))}
              <button type="button" className="chip" aria-pressed={pickCategory} onClick={() => setPickCategory(true)}>
                Muu…
              </button>
            </div>
          )}
          {pickCategory ? (
            <select
              className="select-input path"
              value={draft.category}
              onChange={(e) => {
                const category = e.target.value;
                if (isCategory(category)) setDraft({ ...draft, category });
              }}
            >
              {Object.keys(CATEGORIES)
                .filter(isCategory)
                .map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
            </select>
          ) : (
            <div className="path hint">{categoryLabel(draft.category)}</div>
          )}
        </div>

        <div>
          <div className="field-label">Värit</div>
          <div className="swatches">
            {draft.colors.map((c, i) => (
              <label key={i} className="swatch" style={{ background: rgbCss(c) }} title={rgbToHex(c)}>
                <input
                  type="color"
                  value={rgbToHex(c)}
                  aria-label={`Väri ${i + 1}`}
                  onChange={(e) => {
                    const rgb = hexToRgb(e.target.value);
                    if (rgb) setDraft({ ...draft, colors: draft.colors.map((old, j) => (j === i ? rgb : old)) });
                  }}
                />
                <button
                  type="button"
                  className="remove"
                  aria-label="Poista väri"
                  onClick={() => setDraft({ ...draft, colors: draft.colors.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </label>
            ))}
            {draft.colors.length < MAX_COLORS && (
              <button
                type="button"
                className="swatch-add"
                title="Lisää väri"
                onClick={() => setDraft({ ...draft, colors: [...draft.colors, NEW_COLOR] })}
              >
                <Icon name="plus" />
              </button>
            )}
            <span className="hint">Napauta väriä muuttaaksesi</span>
          </div>
        </div>

        <div>
          <div className="field-label">Tunnisteet</div>
          <div className="toggles">
            <Toggle
              label="yksivärinen"
              on={draft.pattern === "solid"}
              onClick={() => setDraft({ ...draft, pattern: "solid" })}
            />
            <Toggle
              label="kuviollinen"
              on={draft.pattern === "patterned"}
              onClick={() => setDraft({ ...draft, pattern: "patterned" })}
            />
            <Toggle label="arki" on={draft.occasions.includes("everyday")} onClick={() => toggleOccasion("everyday")} />
            <Toggle label="juhla" on={draft.occasions.includes("party")} onClick={() => toggleOccasion("party")} />
            <Toggle label="lämmin" on={draft.warmth === "warm"} onClick={() => toggleWarmth("warm")} />
            <Toggle label="viileä" on={draft.warmth === "cool"} onClick={() => toggleWarmth("cool")} />
            {CATEGORIES[draft.category].slot === "bottom" && (
              <Toggle
                label="pyöräily"
                on={draft.bikeable}
                onClick={() => setDraft({ ...draft, bikeable: !draft.bikeable })}
              />
            )}
            <Toggle
              label="lempivaatteet"
              on={draft.favourite}
              onClick={() => setDraft({ ...draft, favourite: !draft.favourite })}
            />
          </div>
        </div>

        <div>
          <div className="field-label">Kuvaus</div>
          <input
            className="text-input small"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </div>

        <div className="field-row">
          <div>
            <div className="field-label">Merkki</div>
            <input
              className="text-input small"
              value={draft.brand}
              onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
            />
          </div>
          <div>
            <div className="field-label">Materiaali</div>
            <input
              className="text-input small"
              list="materials"
              value={draft.material}
              onChange={(e) => setDraft({ ...draft, material: e.target.value })}
            />
            <datalist id="materials">
              {MATERIALS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
        </div>

        <div>
          <div className="field-label">
            Huomioita <small>istuvuus ja tyyli</small>
          </div>
          <input
            className="text-input small"
            placeholder="esim. liian pitkä korkkareilla"
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </div>

        <div className="review-actions">
          <span className="kbd">
            <kbd>Enter</kbd> tallentaa
          </span>
          {onDelete && (
            <button type="button" className="btn btn-ghost" onClick={onDelete}>
              Poista
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="submit" className="btn btn-primary">
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
};
