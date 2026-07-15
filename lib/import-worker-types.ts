export type ImportWorkerPhase = "parse" | "score";

export interface ImportWorkerProgress {
  readonly phase: ImportWorkerPhase;
  readonly message: string;
  readonly count?: number | undefined;
}

export interface ImportWorkerSuccess {
  readonly players: import("@/src/domain/player.js").Player[];
  readonly report: import("@/src/import/types.js").ImportReport;
  readonly scores: import("@/src/domain/scoring/dataset.js").PlayerScores[];
}

export type ImportWorkerRequest =
  | { readonly id: string; readonly op: "import"; readonly text: string; readonly kind: string }
  | { readonly id: string; readonly op: "score"; readonly players: import("@/src/domain/player.js").Player[] };

export type ImportWorkerReply =
  | { readonly id: string; readonly type: "progress"; readonly progress: ImportWorkerProgress }
  | { readonly id: string; readonly type: "result"; readonly ok: true; readonly data: ImportWorkerSuccess }
  | {
      readonly id: string;
      readonly type: "result";
      readonly ok: false;
      readonly code?: string | undefined;
      readonly message: string;
    };

export const IMPORT_PROGRESS: Record<ImportWorkerPhase, string> = {
  parse: "Reading your export…",
  score: "Scoring players",
};

export function progressMessage(progress: ImportWorkerProgress): string {
  if (progress.phase === "score" && progress.count != null) {
    return `Scoring ${progress.count.toLocaleString()} players against the database…`;
  }
  return progress.message;
}
