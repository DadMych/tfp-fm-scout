import Link from "next/link";
import type { Player } from "@/src/domain/player.js";
import type { Insight } from "@/src/domain/assistant/types.js";
import { FORMATIONS } from "@/src/domain/squad/formations.js";
import { SEVERITY_TONE, surname } from "./shared";

export function InsightRow({
  insight,
  nameById,
  onFormation,
}: {
  insight: Insight;
  nameById: Map<string, Player>;
  onFormation: (id: string) => void;
}) {
  return (
    <li className={`insight sev-${SEVERITY_TONE[insight.severity]}`}>
      <span className="isev" aria-hidden />
      <div className="ibody">
        <div className="ititle">{insight.title}</div>
        <p className="idetail">{insight.detail}</p>
        {insight.evidence.length > 0 ? (
          <div className="ievidence">
            {insight.evidence.map((e, i) => (
              <span key={i} className="epill">
                {e.label}: <b>{e.value}</b>
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <InsightAction insight={insight} nameById={nameById} onFormation={onFormation} />
    </li>
  );
}

function InsightAction({
  insight,
  nameById,
  onFormation,
}: {
  insight: Insight;
  nameById: Map<string, Player>;
  onFormation: (id: string) => void;
}) {
  const action = insight.action;
  if (!action) return null;
  if (action.kind === "formation") {
    const formationId = action.formationId;
    return (
      <button type="button" className="iaction" onClick={() => onFormation(formationId)}>
        Try {FORMATIONS.find((f) => f.id === formationId)?.name}
      </button>
    );
  }
  if (action.kind === "player") {
    return (
      <Link className="iaction" href={`/scout/${action.dataset}/${action.playerId}`}>
        View {surname(nameById.get(action.playerId)?.name ?? "player")}
      </Link>
    );
  }
  if (action.kind === "scout") {
    return (
      <Link className="iaction" href="/scout">
        Scout
      </Link>
    );
  }
  return null;
}
