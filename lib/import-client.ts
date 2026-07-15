import type { Player } from "@/src/domain/player.js";
import { buildScores } from "@/src/domain/scoring/dataset.js";
import type { PlayerScores } from "@/src/domain/scoring/dataset.js";
import { parseExport, ImportError } from "@/src/import/parse.js";
import type { ImportRejectCode } from "@/src/import/types.js";
import type {
  ImportWorkerProgress,
  ImportWorkerReply,
  ImportWorkerRequest,
  ImportWorkerSuccess,
} from "./import-worker-types.js";
import { progressMessage } from "./import-worker-types.js";

let worker: Worker | null = null;
let seq = 0;

function runSyncImport(text: string, kind: string): ImportWorkerSuccess {
  const { players, report } = parseExport(text, kind);
  const scores = buildScores(players);
  return { players, report, scores };
}

function runSyncScore(players: readonly Player[]): PlayerScores[] {
  return buildScores(players);
}

function getWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  if (!worker) {
    worker = new Worker(new URL("./import.worker.ts", import.meta.url));
  }
  return worker;
}

function dispatch(
  req: ImportWorkerRequest,
  onProgress?: (p: ImportWorkerProgress) => void,
): Promise<ImportWorkerSuccess> {
  const w = getWorker();
  if (!w) {
    if (req.op === "import") return Promise.resolve(runSyncImport(req.text, req.kind));
    return Promise.resolve({
      players: req.players,
      report: {
        rowsTotal: req.players.length,
        rowsImported: req.players.length,
        rowsSkipped: [],
        unmappedColumns: [],
        cellIssues: {},
        detectedFormat: "csv",
        maskedAttributeShare: 0,
        rowsWithoutPosition: 0,
        parserVersion: "",
      },
      scores: runSyncScore(req.players),
    });
  }

  return new Promise((resolve, reject) => {
    const active = w;
    function onMessage(ev: MessageEvent<ImportWorkerReply>) {
      const msg = ev.data;
      if (msg.id !== req.id) return;
      if (msg.type === "progress") {
        onProgress?.(msg.progress);
        return;
      }
      active.removeEventListener("message", onMessage);
      if (msg.ok) resolve(msg.data);
      else {
        if (msg.code) {
          reject(new ImportError(msg.code as ImportRejectCode, msg.message));
        } else reject(new Error(msg.message));
      }
    }
    active.addEventListener("message", onMessage);
    active.postMessage(req);
  });
}

export function importDataset(
  text: string,
  kind: string,
  onProgress?: (message: string) => void,
): Promise<ImportWorkerSuccess> {
  const id = `import-${++seq}`;
  return dispatch(
    { id, op: "import", text, kind },
    onProgress ? (p) => onProgress(progressMessage(p)) : undefined,
  );
}

export function scorePlayers(
  players: readonly Player[],
  onProgress?: (message: string) => void,
): Promise<PlayerScores[]> {
  const id = `score-${++seq}`;
  return dispatch(
    { id, op: "score", players: [...players] },
    onProgress ? (p) => onProgress(progressMessage(p)) : undefined,
  ).then((r) => r.scores);
}

export type { ImportReport } from "@/src/import/types.js";
