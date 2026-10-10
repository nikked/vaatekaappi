import { useEffect, useState } from "react";
import { warmUp } from "./models";
import { Outfits } from "./Outfits";
import { Wardrobe } from "./Wardrobe";

const SCREENS = ["Vaatekaappi", "Asut"] as const;
type Screen = (typeof SCREENS)[number];

export const App = () => {
  const [screen, setScreen] = useState<Screen>("Vaatekaappi");

  // A failed download surfaces when a photo is processed, so it isn't reported here.
  useEffect(() => {
    warmUp().catch(() => {});
  }, []);
  return (
    <>
      <nav>
        {SCREENS.map((s) => (
          <button key={s} aria-pressed={s === screen} onClick={() => setScreen(s)}>
            {s}
          </button>
        ))}
      </nav>
      <main>{screen === "Vaatekaappi" ? <Wardrobe /> : <Outfits />}</main>
    </>
  );
};
