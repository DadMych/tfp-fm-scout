"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { WatchToggle } from "@/components/kit/WatchToggle";
import { ArchetypeIcon } from "@/components/kit/ArchetypeIcon";
import { Dateline } from "@/components/kit/Dateline";
import { parseAnchorRef, upgradesHref } from "@/lib/scout-anchor-url";
import { useDatasets } from "@/lib/store";
import { DEFAULT_BUDGET } from "@/src/domain/assistant/defaults.js";
import { buildContext } from "@/src/domain/assistant/context.js";
import { slotFit, type PlayerRow } from "@/src/domain/assistant/xi.js";
import type { SlotAssignment } from "@/src/domain/assistant/slots.js";
import { findUpgrades } from "@/src/domain/scouting/upgrade-finder.js";
import { getFormation } from "@/src/domain/squad/formations.js";
import { getArchetype } from "@/src/domain/archetypes/registry.js";
import { formatMoney } from "@/src/report/format.js";

function resolveSquadRow(
  id: string,
  squad: ReturnType<typeof useDatasets>["squad"],
): PlayerRow | null {
  if (!squad) return null;
  const p = squad.dataset.players.find((x) => x.id === id);
  if (!p) return null;
  const scores = squad.scoreById.get(id);
  if (!scores) return null;
  return { player: p, scores };
}

function anchorSlot(
  incumbent: PlayerRow,
  formationId: string,
  slots: readonly SlotAssignment[],
): SlotAssignment | null {
  for (const slot of slots) {
    if (slot.starter?.id === incumbent.player.id) return slot;
  }
  let best: { slot: SlotAssignment; fit: number } | null = null;
  for (const slot of slots) {
    if (!incumbent.player.positions.includes(slot.slot.slot)) continue;
    const fit = slotFit(incumbent, formationId, slot.slot);
    if (!best || fit > best.fit) best = { slot, fit };
  }
  return best?.slot ?? null;
}

export function UpgradesView() {
  const searchParams = useSearchParams();
  const { shortlist, squad, ready, lastAssistantRun } = useDatasets();
  const anchorRef = useMemo(() => parseAnchorRef(searchParams), [searchParams]);

  const incumbent = useMemo(() => {
    if (!anchorRef || anchorRef.kind !== "squad") return null;
    return resolveSquadRow(anchorRef.id, squad);
  }, [anchorRef, squad]);

  const result = useMemo(() => {
    if (!incumbent || !squad || !shortlist) return null;
    const squadRows = squad.dataset.players.map((p) => ({
      player: p,
      scores: squad.scoreById.get(p.id)!,
    }));
    const shortlistRows = shortlist.dataset.players.map((p) => ({
      player: p,
      scores: shortlist.scoreById.get(p.id)!,
    }));
    const formation = getFormation(lastAssistantRun?.formationId ?? "4-2-3-1");
    const ctx = buildContext({
      squad: squadRows,
      shortlist: shortlistRows,
      formation,
      budget: lastAssistantRun?.budget ?? DEFAULT_BUDGET,
      useFullBudget: lastAssistantRun?.useFull ?? true,
    });
    const slot = anchorSlot(incumbent, formation.id, ctx.slots);
    if (!slot) return null;
    const hits = findUpgrades({
      incumbent,
      formationId: formation.id,
      slot: slot.slot,
      pool: shortlistRows,
      budgetCap: ctx.budgetCap,
    });
    return { slot, hits, formationName: formation.name, budgetCap: ctx.budgetCap };
  }, [incumbent, squad, shortlist, lastAssistantRun]);

  if (!ready) return <div className="empty">Setting the page…</div>;

  if (!anchorRef) {
    return (
      <>
        <Dateline left="Upgrades over" center="No anchor player" right="" />
        <div className="empty">
          Open a squad player dossier and choose{" "}
          <span className="kbd-hint">Find upgrades</span> in the footline.
        </div>
      </>
    );
  }

  if (anchorRef.kind !== "squad") {
    return (
      <>
        <Dateline left="Upgrades over" center="Shortlist player" right="" />
        <div className="empty">
          Upgrades are measured against your squad XI. Open a{" "}
          <Link href="/scout?kind=squad" className="link-red">
            squad player
          </Link>{" "}
          to search the shortlist for replacements.
        </div>
      </>
    );
  }

  if (!incumbent) {
    return (
      <>
        <Dateline left="Upgrades over" center="Player not found" right="" />
        <div className="empty">That squad player is not in the loaded export.</div>
      </>
    );
  }

  if (!shortlist) {
    return (
      <>
        <Dateline left="Upgrades over" center={incumbent.player.name} right="" />
        <div className="empty">
          Load a shortlist export to search for upgrades.{" "}
          <Link href="/upload" className="link-red">
            Upload
          </Link>
        </div>
      </>
    );
  }

  if (!result) {
    return (
      <>
        <Dateline left="Upgrades over" center={incumbent.player.name} right="" />
        <div className="empty">No tactic slot matches this player's positions.</div>
      </>
    );
  }

  const { slot, hits, formationName, budgetCap } = result;

  return (
    <>
      <Dateline
        left="Upgrades over"
        center={`${incumbent.player.name} · ${slot.label}`}
        right={`${formationName} · budget ${formatMoney(budgetCap)}`}
      />

      {hits.length === 0 ? (
        <div className="empty">
          No shortlist player beats him by +5 pair fit within budget at {slot.label}.
        </div>
      ) : (
        <table className="rowlist">
          <thead>
            <tr className="head">
              <th>Player</th>
              <th>Identity</th>
              <th className="c-num">Pair fit</th>
              <th className="c-num">Δ</th>
              <th className="c-num">Age Δ</th>
              <th className="c-num">Value</th>
              <th>Edges</th>
            </tr>
          </thead>
          <tbody>
            {hits.map((hit) => {
              const player = shortlist.dataset.players.find((x) => x.id === hit.playerId);
              const scores = shortlist.scoreById.get(hit.playerId);
              const arch = scores?.topArchetype ? getArchetype(scores.topArchetype.id) : null;
              return (
                <tr className="player" key={hit.playerId}>
                  <td className="c-name">
                    {player ? <WatchToggle player={player} /> : null}
                    <Link className="pname" href={`/scout/shortlist/${hit.playerId}`}>
                      {hit.name}
                    </Link>
                  </td>
                  <td className="c-arch">
                    {scores?.topArchetype ? (
                      <ArchetypeIcon id={scores.topArchetype.id} size={16} />
                    ) : null}
                    <span className="aname">{arch?.name ?? "Utility"}</span>
                  </td>
                  <td className="c-num">
                    <span className="score num">{hit.pairScore}</span>
                  </td>
                  <td className="c-num num">+{hit.delta}</td>
                  <td className="c-num num">
                    {hit.ageDelta != null ? (hit.ageDelta > 0 ? `+${hit.ageDelta}` : hit.ageDelta) : "—"}
                  </td>
                  <td className="c-num num">{hit.value != null ? formatMoney(hit.value) : "—"}</td>
                  <td className="c-detail">
                    {hit.advantages.map((e) => `${e.name} +${e.delta}`).join(" · ")}
                    {hit.downgrade ? ` · ${hit.downgrade.name} ${hit.downgrade.delta}` : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="footline">
        <span>+5 pair-fit floor · budget-capped shortlist</span>
        <span>
          <Link href={`/scout/squad/${anchorRef.id}`}>← Back to dossier</Link>
          {" · "}
          <Link href={upgradesHref(anchorRef.kind, anchorRef.id)}>Refresh</Link>
        </span>
      </div>
    </>
  );
}
