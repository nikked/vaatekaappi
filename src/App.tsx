import { useEffect, useState } from "react";
import { ColorProfile } from "./ColorProfile";
import { requestPersistentStorage } from "./db";
import { Icon, type IconName } from "./Icon";
import { ImportStatus } from "./ImportStatus";
import { ModelBanner } from "./ModelBanner";
import { warmUp } from "./models";
import { Outfits } from "./Outfits";
import { Wardrobe } from "./Wardrobe";

const SCREENS = [
  ["Vaatekaappi", "hanger"],
  ["Asut", "sparkle"],
  ["Värini", "palette"],
] as const satisfies readonly (readonly [string, IconName])[];
type Screen = (typeof SCREENS)[number][0];

export const App = () => {
  const [screen, setScreen] = useState<Screen>("Vaatekaappi");

  // A failed download surfaces when a photo is processed, so it isn't reported here.
  useEffect(() => {
    warmUp().catch(() => {});
    void requestPersistentStorage();
  }, []);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          Kaappi
        </div>
        <nav className="tabs">
          {SCREENS.map(([name, icon]) => (
            <button
              type="button"
              key={name}
              className="tab"
              aria-current={name === screen ? "page" : undefined}
              onClick={() => setScreen(name)}
            >
              <Icon name={icon} />
              {name}
            </button>
          ))}
        </nav>
        <ImportStatus onOpen={() => setScreen("Vaatekaappi")} />
      </header>
      <ModelBanner />
      <main>
        {screen === "Vaatekaappi" && <Wardrobe />}
        {screen === "Asut" && <Outfits />}
        {screen === "Värini" && <ColorProfile />}
      </main>
    </div>
  );
};
