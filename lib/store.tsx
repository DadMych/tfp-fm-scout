"use client";

/**
 * Client-side dataset store (no backend yet).
 *
 * The user's squad and shortlist live entirely in the browser: parsed from an FM26 export,
 * kept in React state, and mirrored to localStorage so a reload doesn't lose them. Only the
 * raw parsed players are persisted; scores/recommendations are recomputed on load because they
 * are pure and cheap. This whole module is the seam a real DB + auth will replace later.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Player } from "@/src/domain/player.js";
import { buildScores, type PlayerScores } from "@/src/domain/scoring/dataset.js";
import { parseExport } from "@/src/import/parse.js";
import { buildSquadContext, type SquadContext } from "@/src/domain/recommendation.js";

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
  readonly lastAssistantRun: LastAssistantRun | null;
  loadText(kind: DatasetKind, text: string, source: string, label?: string): number;
  clear(kind: DatasetKind): void;
  setLastAssistantRun(run: LastAssistantRun): void;
}

const KEY = "tfp.datasets.v1";
const SETTINGS_KEY = "tfp.assistant.v1";

export interface LastAssistantRun {
  readonly formationId: string;
  readonly budget: number;
  readonly useFull: boolean;
}

const Ctx = createContext<StoreState | null>(null);

type Persisted = Partial<Record<DatasetKind, Dataset>>;

function bundle(dataset: Dataset | null): DatasetBundle | null {
  if (!dataset) return null;
  const scores = buildScores(dataset.players);
  return { dataset, scores, scoreById: new Map(scores.map((s) => [s.playerId, s])) };
}

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<Persisted>({});
  const [lastAssistantRun, setLastAssistantRunState] = useState<LastAssistantRun | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) {
        // Hydrate once on mount; client-only store has no SSR snapshot to match.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional localStorage hydration
        setRaw(JSON.parse(stored) as Persisted);
      }
      const settings = localStorage.getItem(SETTINGS_KEY);
      if (settings) setLastAssistantRunState(JSON.parse(settings) as LastAssistantRun);
    } catch {
      // Corrupt or unavailable storage — start empty rather than crash.
    }
    setReady(true);
  }, []);

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

  const loadText = useCallback(
    (kind: DatasetKind, text: string, source: string, label?: string): number => {
      const { players, report } = parseExport(text, kind);
      const dataset: Dataset = {
        label: label ?? source,
        source,
        players,
        maskedShare: report.maskedAttributeShare,
        importedAt: new Date().toISOString(),
      };
      persist((prev) => ({ ...prev, [kind]: dataset }));
      return players.length;
    },
    [persist],
  );

  const clear = useCallback(
    (kind: DatasetKind) => {
      persist((prev) => {
        const next = { ...prev };
        delete next[kind];
        return next;
      });
    },
    [persist],
  );

  // Demo deep-link: `?demo=1` seeds the sample shortlist when nothing is loaded, so the app
  // can be shared/previewed without a manual upload.
  useEffect(() => {
    if (!ready || raw.shortlist) return;
    if (!new URLSearchParams(window.location.search).has("demo")) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/sample-shortlist.csv");
        const text = await res.text();
        if (cancelled) return;
        const { players, report } = parseExport(text, "shortlist");
        persist({
          shortlist: {
            label: "Sample shortlist",
            source: "sample-shortlist.csv",
            players,
            maskedShare: report.maskedAttributeShare,
            importedAt: new Date().toISOString(),
          },
        });
      } catch {
        // Sample unavailable — leave the empty state in place.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, raw.shortlist, persist]);

  const shortlist = useMemo(() => bundle(raw.shortlist ?? null), [raw.shortlist]);
  const squad = useMemo(() => bundle(raw.squad ?? null), [raw.squad]);
  const squadContext = useMemo(
    () => (squad ? buildSquadContext(squad.dataset.players, squad.scores) : null),
    [squad],
  );

  const value = useMemo<StoreState>(
    () => ({ shortlist, squad, squadContext, ready, lastAssistantRun, loadText, clear, setLastAssistantRun }),
    [shortlist, squad, squadContext, ready, lastAssistantRun, loadText, clear, setLastAssistantRun],
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
