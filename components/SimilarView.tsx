"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { WatchToggle } from "@/components/kit/WatchToggle";
import { ArchetypeCell } from "@/components/kit/ArchetypeCell";
import { ArchetypeArt, ArchetypeArtFallback } from "@/components/kit/ArchetypeArt";
import { Dateline } from "@/components/kit/Dateline";
import { parseAnchorRef, similarHref, type PlayerRef } from "@/lib/scout-anchor-url";
import { serializeCompareRefs } from "@/lib/compare-url";
import { useDatasets } from "@/lib/store";
import { findSimilar } from "@/src/domain/scouting/similar.js";
import type { PlayerRow } from "@/src/domain/assistant/xi.js";
import { getArchetype } from "@/src/domain/archetypes/registry.js";
import { formatMoney } from "@/src/report/format.js";

function resolveAnchor(
  ref: PlayerRef,
  shortlist: ReturnType<typeof useDatasets>["shortlist"],
  squad: ReturnType<typeof useDatasets>["squad"],
): PlayerRow | null {
  const bundle = ref.kind === "squad" ? squad : shortlist;
  if (!bundle) return null;
  const p = bundle.dataset.players.find((x) => x.id === ref.id);
  if (!p) return null;
  const scores = bundle.scoreById.get(ref.id);
  if (!scores) return null;
  return { player: p, scores };
}

function poolRows(
  shortlist: ReturnType<typeof useDatasets>["shortlist"],
  squad: ReturnType<typeof useDatasets>["squad"],
): PlayerRow[] {
  const bundle = shortlist ?? squad;
  if (!bundle) return [];
  return bundle.dataset.players.map((p) => ({
    player: p,
    scores: bundle.scoreById.get(p.id)!,
  }));
}

export function SimilarView() {
  const searchParams = useSearchParams();
  const { shortlist, squad, ready } = useDatasets();
  const anchorRef = useMemo(() => parseAnchorRef(searchParams), [searchParams]);

  const anchor = useMemo(
    () => (anchorRef ? resolveAnchor(anchorRef, shortlist, squad) : null),
    [anchorRef, shortlist, squad],
  );

  const hits = useMemo(() => {
    if (!anchor) return [];
    return findSimilar({ anchor, pool: poolRows(shortlist, squad), limit: 25 });
  }, [anchor, shortlist, squad]);

  const poolKind = shortlist ? "shortlist" : squad ? "squad" : null;
  const bundle = shortlist ?? squad;

  if (!ready) return <div className="empty">Setting the page…</div>;

  if (!anchorRef || !anchor) {
    return (
      <>
        <Dateline left="Find similar" center="No anchor player" right="" />
        <div className="empty">
          Open a player dossier and choose{" "}
          <span className="kbd-hint">Find similar</span> in the footline.
        </div>
      </>
    );
  }

  return (
    <>
      <Dateline
        left="Find similar"
        center={anchor.player.name}
        right={poolKind ? `Searching the ${poolKind}` : ""}
      />

      <section className="watch-hero">
        <div>
          <p className="eyebrow">
            {anchor.scores.topArchetype
              ? getArchetype(anchor.scores.topArchetype.id).name
              : anchor.scores.general.family}
          </p>
          <h1>
            <Link href={`/scout/${anchorRef.kind}/${anchorRef.id}`}>{anchor.player.name}</Link>
          </h1>
          <p className="standfirst">{anchor.scores.summary}</p>
        </div>
        {anchor.scores.topArchetype ? (
          <ArchetypeArt id={anchor.scores.topArchetype.id} size="hero" caption />
        ) : (
          <ArchetypeArtFallback family={anchor.scores.general.family} size="hero" />
        )}
      </section>

      {hits.length === 0 ? (
        <div className="empty">No close matches in the loaded export.</div>
      ) : (
        <table className="rowlist">
          <thead>
            <tr className="head">
              <th>Player</th>
              <th>Identity</th>
              <th className="c-num">Match</th>
              <th className="c-num">Age</th>
              <th className="c-num">Value</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {hits.map((hit) => {
              const compareHref = serializeCompareRefs([
                anchorRef,
                { kind: poolKind!, id: hit.playerId },
              ]);
              const player = bundle!.dataset.players.find((x) => x.id === hit.playerId);
              const scores = bundle!.scoreById.get(hit.playerId);
              const arch = scores?.topArchetype ? getArchetype(scores.topArchetype.id) : null;
              return (
                <tr className="player" key={hit.playerId}>
                  <td className="c-name">
                    {player ? <WatchToggle player={player} /> : null}
                    <Link className="pname" href={`/scout/${poolKind}/${hit.playerId}`}>
                      {hit.name}
                    </Link>
                  </td>
                  <td className="c-arch">
                    <ArchetypeCell id={scores?.topArchetype?.id ?? null} family={scores?.general.family ?? "Utility"}>
                      <span className="aname">{arch?.name ?? "Utility"}</span>
                    </ArchetypeCell>
                  </td>
                  <td className="c-num">
                    <span className="score num">{hit.similarity}%</span>
                  </td>
                  <td className="c-num num">{hit.age ?? "—"}</td>
                  <td className="c-num num">{hit.value != null ? formatMoney(hit.value) : "—"}</td>
                  <td>
                    <Link className="link-red" href={compareHref}>
                      Compare
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="footline">
        <span>Cosine match on derived percentiles and archetype shape</span>
        <span>
          <Link href={`/scout/${anchorRef.kind}/${anchorRef.id}`}>← Back to dossier</Link>
          {" · "}
          <Link href={similarHref(anchorRef.kind, anchorRef.id)}>Refresh</Link>
        </span>
      </div>
    </>
  );
}
