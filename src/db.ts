import { currentCategory, isCategory, type Garment, type MaybeProcessedGarment } from "./garment";

const STORE = "garments";

const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open("wardrobe", 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const run = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(request ? request.result : undefined);
    };
    tx.onerror = () => reject(tx.error);
  });
};

// Migrated on every read rather than rewritten in place: cheap, and the new
// path is stored the next time the garment is saved.
export const loadGarments = async (): Promise<MaybeProcessedGarment[]> =>
  ((await run<MaybeProcessedGarment[]>("readonly", (store) => store.getAll())) ?? []).map((g) => {
    const category = currentCategory(g.category);
    return isCategory(category) ? { ...g, category } : g;
  });

export const saveGarment = async (garment: Garment): Promise<void> => {
  await run("readwrite", (store) => store.put(garment));
};

export const deleteGarment = async (id: string): Promise<void> => {
  await run("readwrite", (store) => store.delete(id));
};

// Single transaction: either the whole import lands or nothing changes.
export const replaceGarments = async (garments: readonly Garment[]): Promise<void> => {
  await run("readwrite", (store) => {
    store.clear();
    for (const g of garments) store.put(g);
  });
};
