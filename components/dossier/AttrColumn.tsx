import {
  attributesByCategory,
  getAttribute,
  type AttributeCategory,
  type AttributeId,
} from "@/src/domain/attributes.js";
import type { Player } from "@/src/domain/player.js";
import type { PlayerScores } from "@/src/domain/scoring/dataset.js";
import { AttrValueCell } from "@/components/kit/AttrValue";
import { InkBar } from "@/components/kit/InkBar";

function byCat(c: AttributeCategory): AttributeId[] {
  return attributesByCategory(c).map((a) => a.id as AttributeId);
}

export function attrColumnsFor(scores: PlayerScores): { title: string; ids: AttributeId[] }[] {
  return scores.pop === "gk"
    ? [
        {
          title: "Goalkeeping",
          ids: [...byCat("goalkeeping"), "firstTouch" as AttributeId, "passing" as AttributeId],
        },
        { title: "Mental", ids: byCat("mental") },
        { title: "Physical", ids: byCat("physical") },
      ]
    : [
        { title: "Technical", ids: byCat("technical") },
        { title: "Mental", ids: byCat("mental") },
        { title: "Physical", ids: byCat("physical") },
      ];
}

export function AttrColumn({
  p,
  s,
  title,
  ids,
}: {
  p: Player;
  s: PlayerScores;
  title: string;
  ids: readonly AttributeId[];
}) {
  return (
    <div className="acol">
      <p className="acol-h">{title}</p>
      <table className="atable">
        <tbody>
          {ids.map((id) => {
            const pct = s.percentiles[id] ?? null;
            return (
              <tr key={id}>
                <td className="alabel">{getAttribute(id).name}</td>
                <AttrValueCell v={p.attrs[id]} />
                <td className="abar">
                  <InkBar value={pct} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
