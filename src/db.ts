import type { StoredGarment } from "./garment";
import { migrateGarment } from "./migrate";
import { DEFAULT_PROFILE, isProfile, type Profile } from "./palette";

const GARMENTS = "garments";
// One record under PROFILE_KEY; a store of its own so garment imports can clear theirs.
const SETTINGS = "settings";
const PROFILE_KEY = "profile";

const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open("wardrobe", 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(GARMENTS)) db.createObjectStore(GARMENTS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const run = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = action(tx.objectStore(storeName));
    tx.oncomplete = () => {
      db.close();
      resolve(request ? request.result : undefined);
    };
    tx.onerror = () => reject(tx.error);
  });
};

export type Loaded = { garments: StoredGarment[]; unreadable: number };

// Migrated on every read instead of in a database upgrade: one pure function
// serves the database and backups alike. Records that can't be read are left
// in the database untouched rather than dropped.
export const loadGarments = async (): Promise<Loaded> => {
  const raw = (await run<unknown[]>(GARMENTS, "readonly", (store) => store.getAll())) ?? [];
  const garments = raw.flatMap((r) => {
    try {
      return [migrateGarment(r)];
    } catch {
      return [];
    }
  });
  return { garments, unreadable: raw.length - garments.length };
};

export const saveGarment = async (garment: StoredGarment): Promise<void> => {
  await run(GARMENTS, "readwrite", (store) => store.put(garment));
};

export const deleteGarment = async (id: string): Promise<void> => {
  await run(GARMENTS, "readwrite", (store) => store.delete(id));
};

// Single transaction: either the whole import lands or nothing changes.
export const replaceGarments = async (garments: readonly StoredGarment[]): Promise<void> => {
  await run(GARMENTS, "readwrite", (store) => {
    store.clear();
    for (const g of garments) store.put(g);
  });
};

export const loadProfile = async (): Promise<Profile> => {
  const stored: unknown = await run(SETTINGS, "readonly", (store) => store.get(PROFILE_KEY));
  return isProfile(stored) ? stored : DEFAULT_PROFILE;
};

export const saveProfile = async (profile: Profile): Promise<void> => {
  await run(SETTINGS, "readwrite", (store) => store.put(profile, PROFILE_KEY));
};

// Without this the browser may clear the wardrobe when the disk runs low.
export const requestPersistentStorage = async (): Promise<boolean> =>
  (await navigator.storage?.persist?.()) ?? false;
