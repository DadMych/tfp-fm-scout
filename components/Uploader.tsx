"use client";

import { useRef, useState } from "react";
import { useDatasets, type DatasetKind } from "@/lib/store";
import { ImportError, decodeExportText } from "@/src/import/parse.js";

const ACCEPT = ".csv,.html,.htm,.txt,text/csv,text/html";

export function Uploader({
  kind,
  title,
  hint,
}: {
  kind: DatasetKind;
  title: string;
  hint: string;
}) {
  const { loadText, clear, shortlist, squad, importStatus } = useDatasets();
  const bundle = kind === "squad" ? squad : shortlist;
  const status = importStatus[kind];
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ingest(file: File) {
    setError(null);
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const text = decodeExportText(new Uint8Array(buf));
      const n = await loadText(kind, text, file.name);
      if (n === 0) setError("No players found — is this an FM26 player-list export?");
    } catch (e) {
      if (e instanceof ImportError) setError(e.message);
      else setError("Could not read that file.");
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void ingest(file);
  }

  const filled = !!bundle;
  return (
    <div
      className={`drop${over ? " over" : ""}${filled ? " filled" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void ingest(file);
          e.target.value = "";
        }}
      />
      <h3>{title}</h3>
      {status && !filled ? <div className="import-progress">{status}</div> : null}
      {filled ? (
        <>
          <div className="meta">
            <b>{bundle.dataset.players.length}</b> players · <b>{bundle.dataset.source}</b> ·{" "}
            {Math.round(bundle.dataset.maskedShare * 100)}% masked
          </div>
          <div className="row-actions">
            <button onClick={() => inputRef.current?.click()}>Replace</button>
            <button onClick={() => clear(kind)}>Remove</button>
          </div>
        </>
      ) : (
        <>
          <div className="hint">{hint}</div>
          <div>
            <button className="file-btn" onClick={() => inputRef.current?.click()} disabled={busy || !!status}>
              {busy || status ? "Working…" : "Choose a file"}
            </button>{" "}
            <span className="hint">or drop it here</span>
          </div>
        </>
      )}
      {error ? <div className="err">{error}</div> : null}
    </div>
  );
}
