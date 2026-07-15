"use client";

/**
 * Client-side dataset store (no backend yet).
 *
 * The user's squad and shortlist live entirely in the browser: parsed from an FM26 export,
 * kept in React state, and mirrored to localStorage so a reload doesn't lose them. Only the
 * raw parsed players are persisted; scores are recomputed in a Web Worker on load. This whole
 * module is the seam a real DB + auth will replace later.
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
import type { Player } from "@/src/domain/player.js";
import type { PlayerScores } from "@/src/domain/scoring/dataset.js";
import { ImportError } from "@/src/import/parse.js";
import { buildSquadContext, type SquadContext } from "@/src/domain/recommendation.js";
import { playerIdentityKey } from "@/src/domain/player-identity.js";
import { importDataset, scorePlayers } from "@/lib/import-client";
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
  loadText(kind: DatasetKind, text: string, source: string, label?: string): Promise<number>;
  clear(kind: DatasetKind): void;
  setLastAssistantRun(run: LastAssistantRun): void;
  toggleWatch(p: Player): void;
  setWatchStatus(identityKey: string, status: WatchStatus): void;
  setWatchNote(identityKey: string, note: string): void;
  removeWatch(identityKey: string): void;
  isWatched(p: Player): boolean;
}

const KEY = "tfp.datasets.v1";
const SETTINGS_KEY = "tfp.assistant.v1";
const WATCH_KEY = "tfp.watch.v2";
const WATCH_KEY_LEGACY = "tfp.watch.v1";

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

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<Persisted>({});
  const [scoreByKind, setScoreByKind] = useState<Partial<Record<DatasetKind, PlayerScores[]>>>({});
  const [importStatus, setImportStatus] = useState<Partial<Record<DatasetKind, string>>>({});
  const [lastAssistantRun, setLastAssistantRunState] = useState<LastAssistantRun | null>(null);
  const [watchList, setWatchList] = useState<WatchEntry[]>([]);
  const [ready, setReady] = useState(false);
  const scoringRef = useRef(new Set<DatasetKind>());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional localStorage hydration
        setRaw(JSON.parse(stored) as Persisted);
      }
      const settings = localStorage.getItem(SETTINGS_KEY);
      if (settings) setLastAssistantRunState(JSON.parse(settings) as LastAssistantRun);
      const watch = localStorage.getItem(WATCH_KEY);
      if (watch) {
        setWatchList(JSON.parse(watch) as WatchEntry[]);
      } else {
        const legacy = localStorage.getItem(WATCH_KEY_LEGACY);
        if (legacy) {
          const ids = JSON.parse(legacy) as string[];
          const migrated: WatchEntry[] = [];
          const stored = localStorage.getItem(KEY);
          if (stored) {
            const data = JSON.parse(stored) as Persisted;
            for (const id of ids) {
              for (const kind of ["shortlist", "squad"] as const) {
                const p = data[kind]?.players.find((x) => x.id === id);
                if (p) {
                  migrated.push(createWatchEntry(p));
                  break;
                }
              }
            }
          }
          setWatchList(migrated);
          if (migrated.length > 0) {
            localStorage.setItem(WATCH_KEY, JSON.stringify(migrated));
            localStorage.removeItem(WATCH_KEY_LEGACY);
          }
        }
      }
    } catch {
      // Corrupt or unavailable storage — start empty rather than crash.
    }
    setReady(true);
  }, []);

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

  const persist = useCallback((next: Persisted | ((prev: Persisted) => Persisted)) => {
    setRaw((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      try {
        localStorage.setItem(KEY, JSON.stringify(resolved));
      } catch {
        // Over quota or private mode: keep it in memory for this session.
      }
      return resolved;
    });
  }, []);

  const setLastAssistantRun = useCallback((run: LastAssistantRun) => {
    setLastAssistantRunState(run);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(run));
    } catch {
      // Session-only if storage is unavailable.
    }
  }, []);

  const toggleWatch = useCallback((p: Player) => {
    setWatchList((prev) => {
      const key = playerIdentityKey(p);
      const exists = prev.some((e) => e.identityKey === key);
      const next = exists
        ? prev.filter((e) => e.identityKey !== key)
        : [...prev, createWatchEntry(p)];
      try {
        localStorage.setItem(WATCH_KEY, JSON.stringify(next));
        localStorage.removeItem(WATCH_KEY_LEGACY);
      } catch {
        // Session-only.
      }
      return next;
    });
  }, []);

  const setWatchStatus = useCallback((identityKey: string, status: WatchStatus) => {
    setWatchList((prev) => {
      const next = prev.map((e) => (e.identityKey === identityKey ? { ...e, status } : e));
      try {
        localStorage.setItem(WATCH_KEY, JSON.stringify(next));
      } catch {
        // Session-only.
      }
      return next;
    });
  }, []);

  const setWatchNote = useCallback((identityKey: string, note: string) => {
    setWatchList((prev) => {
      const next = prev.map((e) => (e.identityKey === identityKey ? { ...e, note } : e));
      try {
        localStorage.setItem(WATCH_KEY, JSON.stringify(next));
      } catch {
        // Session-only.
      }
      return next;
    });
  }, []);

  const removeWatch = useCallback((identityKey: string) => {
    setWatchList((prev) => {
      const next = prev.filter((e) => e.identityKey !== identityKey);
      try {
        localStorage.setItem(WATCH_KEY, JSON.stringify(next));
      } catch {
        // Session-only.
      }
      return next;
    });
  }, []);

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
