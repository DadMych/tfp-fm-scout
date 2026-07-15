"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Uploader } from "@/components/Uploader";
import { useDatasets } from "@/lib/store";

export default function HomePage() {
  const router = useRouter();
  const { shortlist, loadText } = useDatasets();
  const [loadingSample, setLoadingSample] = useState(false);

  async function loadSample() {
    setLoadingSample(true);
    try {
      const res = await fetch("/sample-shortlist.csv");
      const text = await res.text();
      loadText("shortlist", text, "sample-shortlist.csv", "Sample shortlist");
    } finally {
      setLoadingSample(false);
    }
  }

  return (
    <div className="wrap">
      <AppHeader current="home" />

      <section className="hero-lead">
        <p className="eyebrow">The FM26 scouting companion</p>
        <h1>Upload your players. Get a scout&rsquo;s verdict.</h1>
        <p>
          Drop in an FM26 export of your squad and your shortlist. We rank every player against
          the database, work out his best roles and archetypes, and tell you plainly who to
          chase, who&rsquo;s a bargain, and who&rsquo;s not for you.
        </p>
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
            hint="Optional — export your own squad and we&rsquo;ll flag shortlist players who'd be a genuine upgrade, position by position."
          />
        </div>
      </div>

      <div className="cta-row">
        <button
          className="btn"
          disabled={!shortlist}
          onClick={() => router.push("/scout")}
        >
          Open the scout desk →
        </button>
        <button className="btn ghost" onClick={() => void loadSample()} disabled={loadingSample}>
          {loadingSample ? "Loading…" : "Try with sample data"}
        </button>
      </div>
    </div>
  );
}
