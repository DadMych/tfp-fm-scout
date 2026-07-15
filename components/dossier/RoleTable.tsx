import { getRole, isRoleId } from "@/src/domain/roles/registry.js";
import type { Player } from "@/src/domain/player.js";
import type { PlayerScores } from "@/src/domain/scoring/dataset.js";
import { InkBar } from "@/components/kit/InkBar";

export function RoleTable({ p, s }: { p: Player; s: PlayerScores }) {
  const posSet = new Set(p.positions);
  const roles = Object.entries(s.roles)
    .flatMap(([rid, r]) =>
      r && isRoleId(rid)
        ? [{ rid, r, eligible: getRole(rid).slots.some((slot) => posSet.has(slot)) }]
        : [],
    )
    .sort((a, b) => b.r.score - a.r.score)
    .slice(0, 8);

  return (
    <>
      <p className="panel-h">
        Roles — strongest fits <span className="role-hint">▸ playable in listed positions</span>
      </p>
      <table className="roletable">
        <thead>
          <tr>
            <th>Role</th>
            <th>Phase</th>
            <th></th>
            <th>Fit</th>
          </tr>
        </thead>
        <tbody>
          {roles.map(({ rid, r, eligible }) => {
            const def = getRole(rid);
            return (
              <tr key={rid} className={eligible ? "elig" : ""}>
                <td className="rname">
                  {eligible ? <span className="tick">▸</span> : null}
                  {def.name}
                </td>
                <td className="rphase">{def.phase}</td>
                <td className="rbar">
                  <InkBar value={r.insufficient ? null : r.score} absolute />
                </td>
                <td className="rscore num">{r.insufficient ? "—" : Math.round(r.score)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
