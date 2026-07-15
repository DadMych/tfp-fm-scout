/**
 * Browser persistence via IndexedDB (replaces localStorage for large exports).
 * One-time migration reads legacy localStorage keys, writes to IDB, verifies, then deletes.
 */

import type { Player } from "../src/domain/player.js";
import { createWatchEntry, type WatchEntry } from "./watch-list";

export const LS_DATASETS_KEY = "tfp.datasets.v1";
export const LS_SETTINGS_KEY = "tfp.assistant.v1";
export const LS_WATCH_KEY = "tfp.watch.v2";
export const LS_WATCH_LEGACY_KEY = "tfp.watch.v1";

const DB_NAME = "tfp-fm";
const DB_VERSION = 1;
const KV_STORE = "kv";

const IDB_DATASETS = "datasets";
const IDB_SETTINGS = "assistant";
const IDB_WATCH = "watch";

type DatasetKind = "shortlist" | "squad";
type DatasetsForMigration = Partial<Record<DatasetKind, { players: Player[] }>>;

export interface ClientStorageSnapshot {
  readonly datasets: unknown;
  readonly assistant: unknown | null;
  readonly watchList: WatchEntry[];
}

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KV_STORE)) {
        db.createObjectStore(KV_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KV_STORE, "readonly");
    const req = tx.objectStore(KV_STORE).get(key);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB read failed"));
    req.onsuccess = () => resolve(req.result as T | undefined);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KV_STORE, "readwrite");
    tx.objectStore(KV_STORE).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
  });
}

export function migrateLegacyWatchIds(
  ids: readonly string[],
  datasets: DatasetsForMigration,
): WatchEntry[] {
  const migrated: WatchEntry[] = [];
  for (const id of ids) {
    for (const kind of ["shortlist", "squad"] as const) {
      const p = datasets[kind]?.players.find((x) => x.id === id);
      if (p) {
        migrated.push(createWatchEntry(p));
        break;
      }
    }
  }
  return migrated;
}

function readLegacySnapshot(): {
  datasets: unknown;
  assistant: unknown | null;
  watchList: WatchEntry[];
  sources: Set<string>;
} {
  const sources = new Set<string>();
  let datasets: unknown = {};
  let assistant: unknown | null = null;
  let watchList: WatchEntry[] = [];

  const rawDatasets = localStorage.getItem(LS_DATASETS_KEY);
  if (rawDatasets) {
    datasets = JSON.parse(rawDatasets) as unknown;
    sources.add(LS_DATASETS_KEY);
  }

  const rawSettings = localStorage.getItem(LS_SETTINGS_KEY);
  if (rawSettings) {
    assistant = JSON.parse(rawSettings) as unknown;
    sources.add(LS_SETTINGS_KEY);
  }

  const rawWatch = localStorage.getItem(LS_WATCH_KEY);
  if (rawWatch) {
    watchList = JSON.parse(rawWatch) as WatchEntry[];
    sources.add(LS_WATCH_KEY);
  } else {
    const legacy = localStorage.getItem(LS_WATCH_LEGACY_KEY);
    if (legacy) {
      const ids = JSON.parse(legacy) as string[];
      watchList = migrateLegacyWatchIds(ids, datasets as DatasetsForMigration);
      sources.add(LS_WATCH_LEGACY_KEY);
      if (watchList.length > 0) sources.add(LS_WATCH_KEY);
    }
  }

  return { datasets, assistant, watchList, sources };
}

function snapshotEmpty(snapshot: ClientStorageSnapshot): boolean {
  const datasets = snapshot.datasets as DatasetsForMigration;
  const hasDatasets = Boolean(datasets.shortlist || datasets.squad);
  return !hasDatasets && snapshot.assistant == null && snapshot.watchList.length === 0;
}

async function verifyAndClearLegacy(
  snapshot: ClientStorageSnapshot,
  sources: Set<string>,
): Promise<void> {
  const datasetsOk =
    JSON.stringify(await idbGet(IDB_DATASETS)) === JSON.stringify(snapshot.datasets);
  const assistantOk =
    snapshot.assistant == null ||
    JSON.stringify(await idbGet(IDB_SETTINGS)) === JSON.stringify(snapshot.assistant);
  const watchOk =
    snapshot.watchList.length === 0 ||
    JSON.stringify(await idbGet(IDB_WATCH)) === JSON.stringify(snapshot.watchList);

  if (!datasetsOk || !assistantOk || !watchOk) return;

  for (const key of sources) {
    localStorage.removeItem(key);
  }
  if (sources.has(LS_WATCH_LEGACY_KEY) || snapshot.watchList.length > 0) {
    localStorage.removeItem(LS_WATCH_KEY);
    localStorage.removeItem(LS_WATCH_LEGACY_KEY);
  }
}

export async function loadClientStorage(): Promise<ClientStorageSnapshot> {
  let datasets: unknown = (await idbGet(IDB_DATASETS)) ?? {};
  let assistant: unknown | null = (await idbGet(IDB_SETTINGS)) ?? null;
  let watchList = (await idbGet<WatchEntry[]>(IDB_WATCH)) ?? [];

  const idbEmpty = snapshotEmpty({ datasets, assistant, watchList });

  if (idbEmpty && hasLocalStorage()) {
    const legacy = readLegacySnapshot();
    if (!snapshotEmpty(legacy)) {
      datasets = legacy.datasets;
      assistant = legacy.assistant;
      watchList = legacy.watchList;

      await idbSet(IDB_DATASETS, datasets);
      if (assistant != null) await idbSet(IDB_SETTINGS, assistant);
      if (watchList.length > 0) await idbSet(IDB_WATCH, watchList);

      await verifyAndClearLegacy({ datasets, assistant, watchList }, legacy.sources);
    }
  }

  return { datasets, assistant, watchList };
}

export async function saveDatasets(datasets: unknown): Promise<void> {
  await idbSet(IDB_DATASETS, datasets);
}

export async function saveAssistantSettings(settings: unknown): Promise<void> {
  await idbSet(IDB_SETTINGS, settings);
}

export async function saveWatchList(list: readonly WatchEntry[]): Promise<void> {
  await idbSet(IDB_WATCH, list);
}

export async function clearClientStorage(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(KV_STORE, "readwrite");
    tx.objectStore(KV_STORE).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB clear failed"));
  });
  if (hasLocalStorage()) {
    localStorage.removeItem(LS_DATASETS_KEY);
    localStorage.removeItem(LS_SETTINGS_KEY);
    localStorage.removeItem(LS_WATCH_KEY);
    localStorage.removeItem(LS_WATCH_LEGACY_KEY);
  }
}
