"use client";

/**
 * Client-side dataset store.
 *
 * Logged out: IndexedDB (local-first). Logged in with hosted auth: Neon via /api/*.
 * Only raw parsed players are persisted; scores recompute in a Web Worker on load.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import type { Player } from "@/src/domain/player.js";
import type { PlayerScores } from "@/src/domain/scoring/dataset.js";
import { ImportError } from "@/src/import/parse.js";
import { buildSquadContext, type SquadContext } from "@/src/domain/recommendation.js";
import { playerIdentityKey } from "@/src/domain/player-identity.js";
import { importDataset, scorePlayers } from "@/lib/import-client";
import {
  loadClientStorage,
  saveAssistantSettings,
  saveDatasets,
  saveWatchList,
} from "@/lib/client-storage";
import {
  loadHostedStorage,
  saveHostedAssistantSettings,
  saveHostedDatasets,
  saveHostedWatchList,
} from "@/lib/hosted-storage";
import {
  createWatchEntry,
  isPlayerWatched,
  type WatchEntry,
  type WatchStatus,
} from "@/lib/watch-list";

export type DatasetKind = "shortlist" | "squad";

export interface Dataset {
  readonly label: string;
  readonly source: string;
  readonly players: Player[];
  readonly maskedShare: number;
  readonly importedAt: string;
}

export interface DatasetBundle {
  readonly dataset: Dataset;
  readonly scores: PlayerScores[];
  readonly scoreById: Map<string, PlayerScores>;
}

interface StoreState {
  readonly shortlist: DatasetBundle | null;
  readonly squad: DatasetBundle | null;
  readonly squadContext: SquadContext | null;
  readonly ready: boolean;
  readonly importStatus: Partial<Record<DatasetKind, string>>;
  readonly lastAssistantRun: LastAssistantRun | null;
  readonly watchList: readonly WatchEntry[];
  readonly hosted: boolean;
  loadText(kind: DatasetKind, text: string, source: string, label?: string): Promise<number>;
  clear(kind: DatasetKind): void;
  setLastAssistantRun(run: LastAssistantRun): void;
  toggleWatch(p: Player): void;
  setWatchStatus(identityKey: string, status: WatchStatus): void;
  setWatchNote(identityKey: string, note: string): void;
  removeWatch(identityKey: string): void;
  isWatched(p: Player): boolean;
}

export interface LastAssistantRun {
  readonly formationId: string;
  readonly budget: number;
  readonly useFull: boolean;
}

const Ctx = createContext<StoreState | null>(null);

type Persisted = Partial<Record<DatasetKind, Dataset>>;

function makeBundle(
  dataset: Dataset | null | undefined,
  scores: PlayerScores[] | undefined,
): DatasetBundle | null {
  if (!dataset || !scores) return null;
  return { dataset, scores, scoreById: new Map(scores.map((s) => [s.playerId, s])) };
}

function applySnapshot(
  snapshot: Awaited<ReturnType<typeof loadClientStorage>>,
  setters: {
    setRaw: (v: Persisted) => void;
    setLastAssistantRunState: (v: LastAssistantRun | null) => void;
    setWatchList: (v: WatchEntry[]) => void;
    setScoreByKind: (v: Partial<Record<DatasetKind, PlayerScores[]>>) => void;
  },
) {
  setters.setRaw(snapshot.datasets as Persisted);
  setters.setLastAssistantRunState(
    snapshot.assistant != null ? (snapshot.assistant as LastAssistantRun) : null,
  );
  setters.setWatchList(snapshot.watchList);
  setters.setScoreByKind({});
}

export function DatasetProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const hosted = Boolean(session?.user?.id);

  const [raw, setRaw] = useState<Persisted>({});
  const [scoreByKind, setScoreByKind] = useState<Partial<Record<DatasetKind, PlayerScores[]>>>({});
  const [importStatus, setImportStatus] = useState<Partial<Record<DatasetKind, string>>>({});
  const [lastAssistantRun, setLastAssistantRunState] = useState<LastAssistantRun | null>(null);
  const [watchList, setWatchList] = useState<WatchEntry[]>([]);
  const [readyTarget, setReadyTarget] = useState<string | null>(null);
  const scoringRef = useRef(new Set<DatasetKind>());
  const storageKey = `${status}:${hosted}`;
  const ready = status !== "loading" && readyTarget === storageKey;

  useEffect(() => {
    if (status === "loading") return;

    const key = storageKey;
    let cancelled = false;

    void (async () => {
      try {
        const snapshot = hosted ? await loadHostedStorage() : await loadClientStorage();
        if (cancelled) return;
        applySnapshot(snapshot, {
          setRaw,
          setLastAssistantRunState,
          setWatchList,
          setScoreByKind,
        });
      } catch {
        // Corrupt or unavailable storage — start empty rather than crash.
      }
      if (!cancelled) setReadyTarget(key);
    })();

    return () => {
      cancelled = true;
    };
  }, [hosted, status, storageKey]);

  useEffect(() => {
    if (!ready) return;
    for (const kind of ["shortlist", "squad"] as const) {
      const ds = raw[kind];
      if (!ds || scoreByKind[kind] || scoringRef.current.has(kind)) continue;
      scoringRef.current.add(kind);
      setImportStatus((s) => ({
        ...s,
        [kind]: `Scoring ${ds.players.length.toLocaleString()} players against the database…`,
      }));
      void scorePlayers(ds.players, (msg) => setImportStatus((s) => ({ ...s, [kind]: msg })))
        .then((scores) => {
          setScoreByKind((prev) => ({ ...prev, [kind]: scores }));
        })
        .finally(() => {
          scoringRef.current.delete(kind);
          setImportStatus((s) => {
            const next = { ...s };
            delete next[kind];
            return next;
          });
        });
    }
  }, [ready, raw, scoreByKind]);

  const persist = useCallback(
    (next: Persisted | ((prev: Persisted) => Persisted)) => {
      setRaw((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        const save = hosted ? saveHostedDatasets : saveDatasets;
        void save(resolved).catch(() => {
          // Private mode, IDB, or API unavailable: keep it in memory for this session.
        });
        return resolved;
      });
    },
    [hosted],
  );

  const setLastAssistantRun = useCallback(
    (run: LastAssistantRun) => {
      setLastAssistantRunState(run);
      const save = hosted ? saveHostedAssistantSettings : saveAssistantSettings;
      void save(run).catch(() => {
        // Session-only if storage is unavailable.
      });
    },
    [hosted],
  );

  const persistWatch = useCallback(
    (next: WatchEntry[]) => {
      const save = hosted ? saveHostedWatchList : saveWatchList;
      void save(next).catch(() => {
        // Session-only.
      });
    },
    [hosted],
  );

  const toggleWatch = useCallback(
    (p: Player) => {
      setWatchList((prev) => {
        const key = playerIdentityKey(p);
        const exists = prev.some((e) => e.identityKey === key);
        const next = exists
          ? prev.filter((e) => e.identityKey !== key)
          : [...prev, createWatchEntry(p)];
        persistWatch(next);
        return next;
      });
    },
    [persistWatch],
  );

  const setWatchStatus = useCallback(
    (identityKey: string, status: WatchStatus) => {
      setWatchList((prev) => {
        const next = prev.map((e) => (e.identityKey === identityKey ? { ...e, status } : e));
        persistWatch(next);
        return next;
      });
    },
    [persistWatch],
  );

  const setWatchNote = useCallback(
    (identityKey: string, note: string) => {
      setWatchList((prev) => {
        const next = prev.map((e) => (e.identityKey === identityKey ? { ...e, note } : e));
        persistWatch(next);
        return next;
      });
    },
    [persistWatch],
  );

  const removeWatch = useCallback(
    (identityKey: string) => {
      setWatchList((prev) => {
        const next = prev.filter((e) => e.identityKey !== identityKey);
        persistWatch(next);
        return next;
      });
    },
    [persistWatch],
  );

  const isWatched = useCallback(
    (p: Player) => isPlayerWatched(p, watchList),
    [watchList],
  );

  const loadText = useCallback(
    async (kind: DatasetKind, text: string, source: string, label?: string): Promise<number> => {
      scoringRef.current.add(kind);
      setImportStatus((s) => ({ ...s, [kind]: "Reading your export…" }));
      try {
        const data = await importDataset(text, kind, (msg) =>
          setImportStatus((s) => ({ ...s, [kind]: msg })),
        );
        if (data.players.length === 0 && data.report.rowsSkipped.length > 0) {
          throw new ImportError(
            "UNRECOGNIZED_FORMAT",
            "No players found — is this an FM26 player-list export?",
          );
        }
        const dataset: Dataset = {
          label: label ?? source,
          source,
          players: data.players,
          maskedShare: data.report.maskedAttributeShare,
          importedAt: new Date().toISOString(),
        };
        setScoreByKind((prev) => ({ ...prev, [kind]: data.scores }));
        persist((prev) => ({ ...prev, [kind]: dataset }));
        return data.players.length;
      } finally {
        scoringRef.current.delete(kind);
        setImportStatus((s) => {
          const next = { ...s };
          delete next[kind];
          return next;
        });
      }
    },
    [persist],
  );

  const clear = useCallback(
    (kind: DatasetKind) => {
      setScoreByKind((prev) => {
        const next = { ...prev };
        delete next[kind];
        return next;
      });
      persist((prev) => {
        const next = { ...prev };
        delete next[kind];
        return next;
      });
    },
    [persist],
  );

  useEffect(() => {
    if (!ready || raw.shortlist) return;
    if (!new URLSearchParams(window.location.search).has("demo")) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/sample-shortlist.csv");
        const text = await res.text();
        if (cancelled) return;
        await loadText("shortlist", text, "sample-shortlist.csv", "Sample shortlist");
      } catch {
        // Sample unavailable — leave the empty state in place.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, raw.shortlist, loadText]);

  const shortlist = useMemo(
    () => makeBundle(raw.shortlist, scoreByKind.shortlist),
    [raw.shortlist, scoreByKind.shortlist],
  );
  const squad = useMemo(
    () => makeBundle(raw.squad, scoreByKind.squad),
    [raw.squad, scoreByKind.squad],
  );
  const squadContext = useMemo(
    () => (squad ? buildSquadContext(squad.dataset.players, squad.scores) : null),
    [squad],
  );

  const value = useMemo<StoreState>(
    () => ({
      shortlist,
      squad,
      squadContext,
      ready,
      importStatus,
      lastAssistantRun,
      watchList,
      hosted,
      loadText,
      clear,
      setLastAssistantRun,
      toggleWatch,
      setWatchStatus,
      setWatchNote,
      removeWatch,
      isWatched,
    }),
    [
      shortlist,
      squad,
      squadContext,
      ready,
      importStatus,
      lastAssistantRun,
      watchList,
      hosted,
      loadText,
      clear,
      setLastAssistantRun,
      toggleWatch,
      setWatchStatus,
      setWatchNote,
      removeWatch,
      isWatched,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDatasets(): StoreState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDatasets must be used within DatasetProvider");
  return ctx;
}

export function useBundle(kind: DatasetKind): DatasetBundle | null {
  const { shortlist, squad } = useDatasets();
  return kind === "squad" ? squad : shortlist;
}
