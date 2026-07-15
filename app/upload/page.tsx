"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Masthead } from "@/components/kit/Masthead";
import { ArchetypeArt, ArchetypeArtFallback } from "@/components/kit/ArchetypeArt";
import { Uploader } from "@/components/Uploader";
import { useDatasets } from "@/lib/store";
import { pickLead } from "@/src/domain/front-page.js";

const UPLOAD_FEATURE_ARCH = "lineBreaker" as const;

export default function UploadPage() {
  const router = useRouter();
  const { shortlist, loadText } = useDatasets();
  const [loadingSample, setLoadingSample] = useState(false);

  const leadArt = useMemo(() => {
    if (!shortlist) return null;
    const rows = shortlist.dataset.players.map((p) => ({
      p,
      s: shortlist.scoreById.get(p.id)!,
    }));
    const lead = pickLead(rows);
    if (!lead) return null;
    return {
      id: lead.s.topArchetype?.id ?? null,
      family: lead.s.general.family,
      name: lead.p.name,
    };
  }, [shortlist]);

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
        <div>
          <p className="eyebrow">Import</p>
          <h1>Upload your players.</h1>
          <p className="standfirst">
            Drop in an FM26 export of your squad and your shortlist. We rank every player against the
            database, work out his best roles and archetypes, and tell you plainly who to chase.
          </p>
        </div>
        {leadArt?.id ? (
          <ArchetypeArt id={leadArt.id} size="hero" priority caption />
        ) : leadArt ? (
          <ArchetypeArtFallback family={leadArt.family} size="hero" />
        ) : (
          <ArchetypeArt id={UPLOAD_FEATURE_ARCH} size="hero" priority caption />
        )}
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
