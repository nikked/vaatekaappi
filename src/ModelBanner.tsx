import { useSyncExternalStore } from "react";
import { megabytes, totalProgress } from "./downloads";
import { getModelStatus, subscribeModelStatus } from "./models";

// First start downloads the models; without explaining that, the app just looks stuck.
export const ModelBanner = () => {
  const { state, downloads } = useSyncExternalStore(
    subscribeModelStatus,
    getModelStatus,
  );
  if (state === "ready") return null;

  if (state === "failed") {
    return (
      <div className="model-banner failed" role="alert">
        <strong>Kuvantunnistusta ei saatu ladattua.</strong>
        <p>
          Tarkista nettiyhteys ja lataa sivu uudelleen. Vaatekaappi ja asut
          toimivat silti.
        </p>
      </div>
    );
  }

  const { loaded, total } = totalProgress(downloads);
  // Without byte counts (models already cached, or being set up after the
  // download) there is nothing to measure, so the bar only shows activity.
  if (total === 0 || loaded >= total) {
    return (
      <div className="model-banner" role="status">
        <strong>Valmistellaan kuvantunnistusta…</strong>
        <div className="busy-bar" />
      </div>
    );
  }

  return (
    <div className="model-banner" role="status">
      <strong>Ladataan kuvantunnistusta…</strong>
      <p>
        Ensimmäisellä kerralla sovellus lataa kuvista vaatteet tunnistavat
        mallit (noin 300 Mt). Ne tallentuvat selaimeen, joten seuraavilla
        kerroilla käynnistys on nopea. Vaatekaappia voi selata sillä aikaa.
      </p>
      <progress max={total} value={loaded} />
      <span className="hint">
        {megabytes(loaded)} / {megabytes(total)}
      </span>
    </div>
  );
};
