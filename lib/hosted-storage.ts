import type { ClientStorageSnapshot } from "./client-storage";
import type { DatasetKind } from "./store";

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "same-origin",
  });
}

export async function loadHostedStorage(): Promise<ClientStorageSnapshot> {
  const res = await apiFetch("/api/state");
  if (res.status === 401 || res.status === 503) {
    return { datasets: {}, assistant: null, watchList: [] };
  }
  if (!res.ok) throw new Error("Could not load account data.");
  const state = (await res.json()) as ClientStorageSnapshot;
  return state;
}

export async function saveHostedDatasets(datasets: unknown): Promise<void> {
  const record = datasets as Partial<Record<DatasetKind, unknown>>;
  for (const kind of ["shortlist", "squad"] as const) {
    const ds = record[kind];
    if (ds) {
      const res = await apiFetch(`/api/datasets/${kind}`, { method: "PUT", body: JSON.stringify(ds) });
      if (!res.ok) throw new Error(`Could not save ${kind}.`);
    } else {
      const res = await apiFetch(`/api/datasets/${kind}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`Could not clear ${kind}.`);
    }
  }
}

export async function saveHostedAssistantSettings(settings: unknown): Promise<void> {
  const res = await apiFetch("/api/assistant", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error("Could not save assistant settings.");
}

export async function saveHostedWatchList(list: unknown): Promise<void> {
  const res = await apiFetch("/api/watch", { method: "PUT", body: JSON.stringify(list) });
  if (!res.ok) throw new Error("Could not save watch list.");
}

export async function importLocalToHosted(snapshot: ClientStorageSnapshot): Promise<void> {
  const res = await apiFetch("/api/state/import-local", {
    method: "POST",
    body: JSON.stringify(snapshot),
  });
  if (!res.ok) throw new Error("Could not import browser data to your account.");
}

export function clientSnapshotEmpty(snapshot: ClientStorageSnapshot): boolean {
  const datasets = snapshot.datasets as Partial<Record<DatasetKind, { players: unknown[] }>>;
  const hasDatasets = Boolean(datasets.shortlist || datasets.squad);
  return !hasDatasets && snapshot.assistant == null && snapshot.watchList.length === 0;
}
