import { FORMATIONS } from "@/src/domain/squad/formations.js";

export function AssistantControls({
  formationId,
  budgetM,
  squadCap,
  useFull,
  onFormationChange,
  onBudgetChange,
  onSquadCapChange,
  onUseFullChange,
  onRun,
}: {
  formationId: string;
  budgetM: string;
  squadCap: string;
  useFull: boolean;
  onFormationChange: (id: string) => void;
  onBudgetChange: (v: string) => void;
  onSquadCapChange: (v: string) => void;
  onUseFullChange: (v: boolean) => void;
  onRun: () => void;
}) {
  return (
    <div className="brief">
      <div className="field">
        <label htmlFor="assist-formation">Formation</label>
        <select
          className="control"
          id="assist-formation"
          value={formationId}
          onChange={(e) => onFormationChange(e.target.value)}
        >
          {FORMATIONS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="assist-budget">Transfer budget (€M)</label>
        <input
          className="control"
          id="assist-budget"
          type="number"
          min={0}
          value={budgetM}
          onChange={(e) => onBudgetChange(e.target.value)}
          style={{ minWidth: 110 }}
        />
      </div>
      <div className="field">
        <label htmlFor="assist-squad-cap">Squad cap</label>
        <input
          className="control"
          id="assist-squad-cap"
          type="number"
          min={11}
          max={40}
          value={squadCap}
          onChange={(e) => onSquadCapChange(e.target.value)}
          style={{ minWidth: 80 }}
        />
      </div>
      <label className="check">
        <input type="checkbox" checked={useFull} onChange={(e) => onUseFullChange(e.target.checked)} />
        Spend full budget (ignore 80% wage buffer)
      </label>
      <button type="button" className="btn" onClick={onRun}>
        Run smart search
      </button>
    </div>
  );
}
