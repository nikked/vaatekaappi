import { useEffect, useState } from "react";
import { hexToRgb, rgbToHex } from "./color";
import { loadProfile, saveProfile } from "./db";
import { rgbCss } from "./GarmentForm";
import type { Rgb } from "./garment";
import { Icon } from "./Icon";
import {
  type Profile,
  profileFor,
  SEASON_LABELS,
  type SeasonType,
} from "./palette";

const SEASON_GROUPS: readonly [string, readonly SeasonType[]][] = [
  ["Kevät", ["light-spring", "warm-spring", "clear-spring"]],
  ["Kesä", ["light-summer", "cool-summer", "soft-summer"]],
  ["Syksy", ["soft-autumn", "warm-autumn", "deep-autumn"]],
  ["Talvi", ["deep-winter", "cool-winter", "clear-winter"]],
];
// Grey start for a new color: the user picks the real one right after adding.
const NEW_COLOR: Rgb = [128, 128, 128];

export const ColorProfile = () => {
  const [profile, setProfile] = useState<Profile>();

  useEffect(() => {
    void loadProfile().then(setProfile);
  }, []);

  if (!profile) return null;

  const update = (next: Profile) => {
    setProfile(next);
    void saveProfile(next);
  };
  const setPalette = (palette: Rgb[]) => update({ ...profile, palette });

  return (
    <>
      <div className="screen-head">
        <div className="grow">
          <h1>Värini</h1>
          <p>Asut pisteytetään näiden värien mukaan.</p>
        </div>
      </div>

      <section className="panel">
        <h2>Värityyppi</h2>
        <p className="hint">
          Värityypin vaihto korvaa paletin sen oletusväreillä.
        </p>
        <div className="season-groups">
          {SEASON_GROUPS.map(([group, seasons]) => (
            <div key={group} className="season-group">
              <span className="picker-label">{group}</span>
              <div className="suggest">
                {seasons.map((season) => (
                  <button
                    key={season}
                    className="chip"
                    aria-pressed={profile.season === season}
                    onClick={() => update(profileFor(season))}
                  >
                    {SEASON_LABELS[season]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Paletti</h2>
        <p className="hint">
          Mitä lähempänä vaatteen väri on jotakin näistä, sitä paremmin asu
          sopii sinulle.
        </p>
        <div className="swatches">
          {profile.palette.map((c, i) => (
            <label
              key={i}
              className="swatch"
              style={{ background: rgbCss(c) }}
              title={rgbToHex(c)}
            >
              <input
                type="color"
                value={rgbToHex(c)}
                aria-label={`Väri ${i + 1}`}
                onChange={(e) => {
                  const rgb = hexToRgb(e.target.value);
                  if (rgb)
                    setPalette(
                      profile.palette.map((old, j) => (j === i ? rgb : old)),
                    );
                }}
              />
              {profile.palette.length > 1 && (
                <button
                  type="button"
                  className="remove"
                  aria-label="Poista väri"
                  onClick={() =>
                    setPalette(profile.palette.filter((_, j) => j !== i))
                  }
                >
                  ×
                </button>
              )}
            </label>
          ))}
          <button
            type="button"
            className="swatch-add"
            title="Lisää väri"
            onClick={() => setPalette([...profile.palette, NEW_COLOR])}
          >
            <Icon name="plus" />
          </button>
        </div>
        <div className="outfit-actions">
          <button
            className="btn btn-soft"
            onClick={() => update(profileFor(profile.season))}
          >
            Palauta oletusvärit
          </button>
        </div>
      </section>
    </>
  );
};
