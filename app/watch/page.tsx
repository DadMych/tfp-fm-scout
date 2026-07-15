"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Masthead } from "@/components/kit/Masthead";
import { ArchetypeIcon } from "@/components/kit/ArchetypeIcon";
import { Dateline } from "@/components/kit/Dateline";
import { VerdictBadge } from "@/components/VerdictBadge";
import { useDatasets } from "@/lib/store";
import {
  resolveWatchEntries,
  WATCH_STATUSES,
  WATCH_STATUS_LABEL,
  type WatchStatus,
} from "@/lib/watch-list";
import { getArchetype } from "@/src/domain/archetypes/registry.js";
import { recommend } from "@/src/domain/recommendation.js";

export default function WatchPage() {
  const {
    shortlist,
    squad,
    squadContext,
    ready,
    watchList,
    setWatchStatus,
    setWatchNote,
    removeWatch,
  } = useDatasets();

  const resolved = useMemo(
    () =>
      resolveWatchEntries(
        watchList,
        shortlist?.dataset.players ?? null,
        squad?.dataset.players ?? null,
      ),
    [watchList, shortlist, squad],
  );

  const entries = useMemo(() => {
    return resolved.map(({ entry, p, kind, id }) => {
      const s = (kind === "squad" ? squad : shortlist)!.scoreById.get(id)!;
      const arch = s.topArchetype ? getArchetype(s.topArchetype.id).name : "Utility";
      return {
        entry,
        id,
        name: p.name,
        kind,
        archId: s.topArchetype?.id ?? null,
        arch,
        score: Math.round(s.topArchetype?.score ?? 0),
        rec: recommend(p, s, kind === "shortlist" ? (squadContext ?? undefined) : undefined),
      };
    });
  }, [resolved, shortlist, squad, squadContext]);

  const missing = watchList.length - entries.length;

  return (
    <div className="wrap">
      <Masthead current="watch" />
      <Dateline
        left="Watch list"
        center={`${entries.length} active${missing > 0 ? ` · ${missing} awaiting re-import` : ""}`}
        right="Press s on the desk to add"
      />

      {!ready ? (
        <div className="empty">Setting the page…</div>
      ) : watchList.length === 0 ? (
        <div className="empty">
          No one on the watch list yet. Open the{" "}
          <Link href="/scout" className="link-red">
            scout desk
          </Link>{" "}
          and press <span className="kbd-hint">s</span> on a player.
        </div>
      ) : (
        <table className="rowlist watch-table">
          <thead>
            <tr className="head">
              <th>Player</th>
              <th>Status</th>
              <th>Verdict</th>
              <th>Identity</th>
              <th className="c-num">Score</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr className="player" key={e.entry.identityKey}>
                <td className="c-name">
                  <Link className="pname" href={`/scout/${e.kind}/${e.id}`}>
                    {e.name}
                  </Link>
                  <div className="sub">{e.kind === "shortlist" ? "Shortlist" : "Squad"}</div>
                </td>
                <td>
                  <select
                    className="control watch-status"
                    value={e.entry.status}
                    onChange={(ev) =>
                      setWatchStatus(e.entry.identityKey, ev.target.value as WatchStatus)
                    }
                  >
                    {WATCH_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {WATCH_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="c-verdict">
                  <VerdictBadge rec={e.rec} />
                </td>
                <td className="c-arch">
                  {e.archId ? <ArchetypeIcon id={e.archId} size={16} /> : null}
                  <span className="aname">{e.arch}</span>
                </td>
                <td className="c-num">
                  <span className="score num">{e.score}</span>
                </td>
                <td className="c-note">
                  <input
                    className="control watch-note"
                    placeholder="One-line note…"
                    value={e.entry.note}
                    onChange={(ev) => setWatchNote(e.entry.identityKey, ev.target.value)}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => removeWatch(e.entry.identityKey)}
                  >
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
