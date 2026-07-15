/// <reference lib="webworker" />

import { buildScores } from "../src/domain/scoring/dataset.js";
import { ENGINE_VERSION } from "../src/domain/engine-version.js";
import { parseExport, ImportError } from "../src/import/parse.js";
import type { ImportWorkerProgress, ImportWorkerReply, ImportWorkerRequest } from "./import-worker-types.js";
import { IMPORT_PROGRESS } from "./import-worker-types.js";

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

function postProgress(id: string, phase: "parse" | "score", count?: number): void {
  const progress: ImportWorkerProgress = {
    phase,
    message: phase === "parse" ? IMPORT_PROGRESS.parse : IMPORT_PROGRESS.score,
    ...(count != null ? { count } : {}),
  };
  const message: ImportWorkerReply = { id, type: "progress", progress };
  ctx.postMessage(message);
}

ctx.addEventListener("message", (ev: MessageEvent<ImportWorkerRequest>) => {
  const req = ev.data;
  try {
    if (req.op === "import") {
      postProgress(req.id, "parse");
      const { players, report } = parseExport(req.text, req.kind);
      postProgress(req.id, "score", players.length);
      const scores = buildScores(players);
      const reply: ImportWorkerReply = {
        id: req.id,
        type: "result",
        ok: true,
        data: { players, report, scores },
      };
      ctx.postMessage(reply);
      return;
    }

    postProgress(req.id, "score", req.players.length);
    const scores = buildScores(req.players);
    const reply: ImportWorkerReply = {
      id: req.id,
      type: "result",
      ok: true,
      data: {
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
          parserVersion: ENGINE_VERSION,
        },
        scores,
      },
    };
    ctx.postMessage(reply);
  } catch (e) {
    const reply: ImportWorkerReply = {
      id: req.id,
      type: "result",
      ok: false,
      message: e instanceof ImportError ? e.message : "Import failed.",
      ...(e instanceof ImportError ? { code: e.code } : {}),
    };
    ctx.postMessage(reply);
  }
});

export {};
