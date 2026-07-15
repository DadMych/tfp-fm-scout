"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { parseCompareRefs, serializeCompareRefs, type PlayerRef } from "@/lib/compare-url";
import { useDatasets, type DatasetKind } from "@/lib/store";
import { ATTRIBUTES, attributesByCategory, type AttributeCategory, type AttributeId } from "@/src/domain/attributes.js";
import { getArchetype } from "@/src/domain/archetypes/registry.js";
import { bestAttrMid, presetPairForSlot, COMPARE_DERIVED } from "@/src/domain/compare.js";
import { DEFAULT_FORMATION_ID } from "@/src/domain/assistant/defaults.js";
import { getRole } from "@/src/domain/roles/registry.js";
import { getSlotPair } from "@/src/domain/squad/tactic-presets.js";
import { slotKeyForPosition } from "@/src/domain/assistant/xi.js";
import type { Player } from "@/src/domain/player.js";
import type { PlayerScores } from "@/src/domain/scoring/dataset.js";
import type { PositionSlot } from "@/src/domain/positions.js";
import { formatMoney, metricLabel } from "@/src/report/format.js";
import { CompareRadar } from "@/components/CompareRadar";
import { Dateline } from "@/components/kit/Dateline";
import { InkBar } from "@/components/kit/InkBar";
import { parseAttrDisplay } from "@/components/kit/AttrValue";

interface ResolvedPlayer {
  readonly ref: PlayerRef;
  readonly p: Player;
  readonly s: PlayerScores;
}

const CATEGORIES: readonly AttributeCategory[] = ["technical", "mental", "physical", "goalkeeping"];

const DERIVED_LABEL: Record<string, string> = {
  finishingPkg: "Finishing",
  creativity: "Creativity",
  pressResist: "Press-res.",
  speed: "Speed",
  workEngine: "Work rate",
  aerial: "Aerial",
  defActivity: "Def. work",
  defPosition: "Def. pos.",
};

function resolveRef(
  ref: PlayerRef,
  shortlist: ReturnType<typeof useDatasets>["shortlist"],
  squad: ReturnType<typeof useDatasets>["squad"],
): ResolvedPlayer | null {
  const bundle = ref.kind === "squad" ? squad : shortlist;
  if (!bundle) return null;
  const p = bundle.dataset.players.find((x) => x.id === ref.id);
  if (!p) return null;
  const s = bundle.scoreById.get(ref.id);
  if (!s) return null;
  return { ref, p, s };
}

function sharedSlots(players: readonly ResolvedPlayer[]): PositionSlot[] {
  if (players.length === 0) return [];
  const sets = players.map((x) => new Set(x.p.positions));
  const first = sets[0]!;
  return [...first].filter((slot) => sets.every((s) => s.has(slot)));
}

export function CompareView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { shortlist, squad, ready, lastAssistantRun } = useDatasets();
  const formationId = lastAssistantRun?.formationId ?? DEFAULT_FORMATION_ID;
  const refs = useMemo(() => parseCompareRefs(searchParams), [searchParams]);
  const [slotPick, setSlotPick] = useState<PositionSlot | "">("");

  const players = useMemo(
    () => refs.map((r) => resolveRef(r, shortlist, squad)).filter((x): x is ResolvedPlayer => x != null),
    [refs, shortlist, squad],
  );

  const slotOptions = useMemo(() => sharedSlots(players), [players]);
  const slot = useMemo(() => {
    if (slotOptions.length === 0) return "";
    if (slotPick && slotOptions.includes(slotPick)) return slotPick;
    return slotOptions[0]!;
  }, [slotOptions, slotPick]);

  const slotPairLabel = useMemo(() => {
    if (!slot) return null;
    const key = slotKeyForPosition(formationId, slot);
    const pair = key ? getSlotPair(formationId, key) : null;
    if (!pair) return null;
    return `${getRole(pair.ip).name} / ${getRole(pair.oop).name}`;
  }, [slot, formationId]);

  const pool = useMemo(() => {
    const out: { kind: DatasetKind; id: string; name: string; label: string }[] = [];
    for (const bundle of [shortlist, squad]) {
      if (!bundle) continue;
      const kind = bundle === shortlist ? "shortlist" : "squad";
      for (const p of bundle.dataset.players) {
        out.push({
          kind,
          id: p.id,
          name: p.name,
          label: `${p.name} (${kind === "shortlist" ? "shortlist" : "squad"})`,
        });
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [shortlist, squad]);

  function setRefs(next: PlayerRef[]) {
    router.replace(serializeCompareRefs(next), { scroll: false });
  }

  function addRef(kind: DatasetKind, id: string) {
    if (refs.length >= 4) return;
    if (refs.some((r) => r.kind === kind && r.id === id)) return;
    setRefs([...refs, { kind, id }]);
  }

  function removeRef(ref: PlayerRef) {
    setRefs(refs.filter((r) => !(r.kind === ref.kind && r.id === ref.id)));
  }

  if (!ready) return <div className="empty">Setting the page…</div>;

  return (
    <>
      <Dateline
        left="Compare"
        center={`${players.length} of ${refs.length} loaded`}
        right="Share this URL"
      />

      <div className="cmp-toolbar">
        <div className="field">
          <label htmlFor="cmp-add">Add player</label>
          <select
            className="control"
            id="cmp-add"
            value=""
            disabled={refs.length >= 4}
            onChange={(e) => {
              const raw = e.target.value;
              if (!raw) return;
              const [kind, id] = raw.split(":") as [DatasetKind, string];
              addRef(kind, id);
            }}
          >
            <option value="">Choose…</option>
            {pool.map((p) => (
              <option key={`${p.kind}:${p.id}`} value={`${p.kind}:${p.id}`}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        {slotOptions.length > 0 ? (
          <div className="field">
            <label htmlFor="cmp-slot">Role-pair slot</label>
            <select className="control" id="cmp-slot" value={slot} onChange={(e) => setSlotPick(e.target.value as PositionSlot)}>
              {slotOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {players.length < 2 ? (
        <div className="empty">
          Pick at least two players to compare. Open a{" "}
          <Link href="/scout" className="link-red">
            dossier
          </Link>{" "}
          and use Compare in the footline, or add players above.
        </div>
      ) : (
        <>
          <div className="cmp-heads">
            {players.map(({ ref, p, s }) => {
              const arch = s.topArchetype ? getArchetype(s.topArchetype.id) : null;
              return (
                <article className="cmp-head" key={`${ref.kind}:${ref.id}`}>
                  <button
                    type="button"
                    className="cmp-remove"
                    onClick={() => removeRef(ref)}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                  <Link className="cmp-name" href={`/scout/${ref.kind}/${p.id}`}>
                    {p.name}
                  </Link>
                  <p className="cmp-meta">
                    {p.age != null ? `Age ${p.age}` : "Age —"}
                    {" · "}
                    {p.positions.join("/") || "—"}
                    {" · "}
                    <span className="num">{formatMoney(p.value)}</span>
                  </p>
                  <p className="cmp-arch">
                    <b>{arch?.name ?? "Utility"}</b>
                    {s.topArchetype?.badge ? (
                      <span className={`stamp ${s.topArchetype.badge === "Elite" ? "gold" : ""}`}>
                        {s.topArchetype.badge}
                      </span>
                    ) : null}
                    <span className="num"> {Math.round(s.topArchetype?.score ?? 0)}</span>
                  </p>
                  <p className="cmp-known">
                    Known <span className="num">{Math.round(s.confidence * 100)}%</span>
                  </p>
                </article>
              );
            })}
          </div>

          <p className="section-label">Derived metrics</p>
          <CompareRadar entries={players.map((x) => ({ name: x.p.name, scores: x.s }))} />

          <p className="section-label">Percentile table</p>
          <table className="cmp-table">
            <thead>
              <tr>
                <th>Metric</th>
                {players.map((x) => (
                  <th key={`${x.ref.kind}:${x.ref.id}`}>{x.p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_DERIVED.map((id) => {
                const pcts = players.map((x) => x.s.percentiles[id] ?? null);
                const known = pcts.filter((v): v is number => v != null);
                const top = known.length ? Math.max(...known) : -1;
                return (
                  <tr key={id}>
                    <td>{DERIVED_LABEL[id] ?? metricLabel(id)}</td>
                    {pcts.map((v, i) => (
                      <td key={i} className={v != null && v === top ? "cmp-best" : ""}>
                        {v != null ? (
                          <div className="cmp-barcell">
                            <InkBar value={v} width={56} />
                            <span className="num">{Math.round(v)}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {slot ? (
            <>
              <p className="section-label">
                Role pair at {slot}
                {slotPairLabel ? ` — ${slotPairLabel}` : ""}
              </p>
              <table className="cmp-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>In possession</th>
                    <th>Out of possession</th>
                    <th className="c-num">Pair</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map(({ ref, p }) => {
                    const pair = presetPairForSlot(p.attrs, formationId, slot);
                    const top =
                      pair != null &&
                      players.every((x) => {
                        const other = presetPairForSlot(x.p.attrs, formationId, slot);
                        return !other || pair.score >= other.score;
                      });
                    return (
                      <tr key={`${ref.kind}:${ref.id}`}>
                        <td>{p.name}</td>
                        <td>{pair?.ipName ?? "—"}</td>
                        <td>{pair?.oopName ?? "—"}</td>
                        <td className={`c-num${top ? " cmp-best" : ""}`}>
                          {pair ? Math.round(pair.score) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : null}

          <p className="section-label">Attributes</p>
          {CATEGORIES.map((cat) => {
            const ids = attributesByCategory(cat).map((a) => a.id);
            const rows = ids.filter((id) =>
              players.some((x) => parseAttrDisplay(x.p.attrs[id as AttributeId]).text !== "?"),
            );
            if (rows.length === 0) return null;
            const title = cat.charAt(0).toUpperCase() + cat.slice(1);
            return (
              <div key={cat} className="cmp-attr-block">
                <p className="cmp-attr-title">{title}</p>
                <table className="cmp-table">
                  <thead>
                    <tr>
                      <th>Attribute</th>
                      {players.map((x) => (
                        <th key={`${x.ref.kind}:${x.ref.id}`}>{x.p.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((id) => {
                      const def = ATTRIBUTES.find((a) => a.id === id)!;
                      const best = bestAttrMid(
                        players.map((x) => x.p.attrs),
                        id as AttributeId,
                      );
                      return (
                        <tr key={id}>
                          <td>{def.name}</td>
                          {players.map((x, i) => {
                            const d = parseAttrDisplay(x.p.attrs[id as AttributeId]);
                            const win = best?.winners.includes(i) ?? false;
                            return (
                              <td
                                key={i}
                                className={[
                                  "num",
                                  win && best && best.winners.length === 1 ? "cmp-best" : "",
                                  d.masked ? "masked" : "",
                                  d.ranged ? "ranged" : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              >
                                {d.text}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </>
      )}

      <div className="footline">
        <span>Compare up to four players</span>
        <span>
          <Link href="/scout">← Scout desk</Link>
        </span>
      </div>
    </>
  );
}
