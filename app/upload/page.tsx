"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Masthead } from "@/components/kit/Masthead";
import { BroadsheetIllustration } from "@/components/kit/BroadsheetIllustration";
import { Uploader } from "@/components/Uploader";
import { useDatasets } from "@/lib/store";

export default function UploadPage() {
  const router = useRouter();
  const { shortlist, loadText } = useDatasets();
  const [loadingSample, setLoadingSample] = useState(false);

  async function loadSample() {
    setLoadingSample(true);
    try {
      const res = await fetch("/sample-shortlist.csv");
      const text = await res.text();
      await loadText("shortlist", text, "sample-shortlist.csv", "Sample shortlist");
      router.push("/");
    } finally {
      setLoadingSample(false);
    }
  }

  return (
    <div className="wrap">
      <Masthead current="upload" />

      <section className="hero-lead upload-hero">
        <BroadsheetIllustration id="empty-desk" width={200} className="upload-hero-art" />
        <div>
          <p className="eyebrow">Import</p>
          <h1>Upload your players.</h1>
          <p>
            Drop in an FM26 export of your squad and your shortlist. We rank every player against the
            database, work out his best roles and archetypes, and tell you plainly who to chase.
          </p>
        </div>
      </section>

      <div className="uploads">
        <div>
          <p className="section-label">Your shortlist</p>
          <Uploader
            kind="shortlist"
            title="Scouting shortlist"
            hint="An FM26 player-search export (CSV or the exported HTML view). This is the pool we recommend from."
          />
        </div>
        <div>
          <p className="section-label">Your squad</p>
          <Uploader
            kind="squad"
            title="Current squad"
            hint="Optional — export your own squad and we'll flag shortlist players who'd be a genuine upgrade."
          />
        </div>
      </div>

      <div className="cta-row">
        <button
          type="button"
          className="btn"
          disabled={!shortlist}
          onClick={() => router.push("/")}
        >
          Open front page →
        </button>
        <button type="button" className="btn ghost" onClick={() => void loadSample()} disabled={loadingSample}>
          {loadingSample ? "Loading…" : "Try with sample data"}
        </button>
      </div>
    </div>
  );
}
