import { useSyncExternalStore } from "react";
import { getImports, subscribeImports } from "./imports";

// Visible on every screen, since recognition keeps running while she browses outfits.
export const ImportStatus = ({ onOpen }: { onOpen: () => void }) => {
  const { done, total, drafts } = useSyncExternalStore(
    subscribeImports,
    getImports,
  );
  if (total > 0) {
    return (
      <button type="button" className="import-status" onClick={onOpen}>
        <progress max={total} value={done} />
        Tunnistetaan kuvia {done + 1} / {total}
      </button>
    );
  }
  if (drafts.length > 0) {
    return (
      <button type="button" className="import-status" onClick={onOpen}>
        {drafts.length} tarkistettavana
      </button>
    );
  }
  return null;
};
