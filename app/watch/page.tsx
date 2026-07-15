"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Masthead } from "@/components/kit/Masthead";
import { Dateline } from "@/components/kit/Dateline";
import { VerdictBadge } from "@/components/VerdictBadge";
import { useDatasets } from "@/lib/store";
import { getArchetype } from "@/src/domain/archetypes/registry.js";
import { recommend } from "@/src/domain/recommendation.js";

export default function WatchPage() {
  const { shortlist, squad, squadContext, ready, watchIds, toggleWatch } = useDatasets();

  const entries = useMemo(() => {
    const out: {
      id: string;
      name: string;
      kind: "shortlist" | "squad";
      arch: string;
      score: number;
      rec: ReturnType<typeof recommend>;
    }[] = [];
    for (const bundle of [shortlist, squad]) {
      if (!bundle) continue;
      const kind = bundle === shortlist ? "shortlist" : "squad";
      for (const id of watchIds) {
        const p = bundle.dataset.players.find((x) => x.id === id);
        if (!p) continue;
        const s = bundle.scoreById.get(id)!;
        const arch = s.topArchetype ? getArchetype(s.topArchetype.id).name : "Utility";
        out.push({
          id,
          name: p.name,
          kind,
          arch,
          score: Math.round(s.topArchetype?.score ?? 0),
          rec: recommend(p, s, kind === "shortlist" ? (squadContext ?? undefined) : undefined),
        });
      }
    }
    const seen = new Set<string>();
    return out.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [shortlist, squad, squadContext, watchIds]);

  return (
    <div className="wrap">
      <Masthead current="watch" />
      <Dateline left="Watch list" center={`${entries.length} players`} right="Press s on the desk to add" />

      {!ready ? (
        <div className="empty">Setting the page…</div>
      ) : entries.length === 0 ? (
        <div className="empty">
          No one on the watch list yet. Open the{" "}
          <Link href="/scout" className="link-red">
            scout desk
          </Link>{" "}
          and press <span className="kbd-hint">s</span> on a player.
        </div>
      ) : (
        <table className="rowlist">
          <thead>
            <tr className="head">
              <th>Player</th>
              <th>Verdict</th>
              <th>Identity</th>
              <th className="c-num">Score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr className="player" key={e.id}>
                <td className="c-name">
                  <Link className="pname" href={`/scout/${e.kind}/${e.id}`}>
                    {e.name}
                  </Link>
                  <div className="sub">{e.kind === "shortlist" ? "Shortlist" : "Squad"}</div>
                </td>
                <td className="c-verdict">
                  <VerdictBadge rec={e.rec} />
                </td>
                <td className="c-arch">
                  <span className="aname">{e.arch}</span>
                </td>
                <td className="c-num">
                  <span className="score num">{e.score}</span>
                </td>
                <td>
                  <button type="button" className="btn ghost" onClick={() => toggleWatch(e.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
