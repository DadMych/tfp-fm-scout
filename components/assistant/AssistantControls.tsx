import { FORMATIONS } from "@/src/domain/squad/formations.js";

export function AssistantControls({
  formationId,
  budgetM,
  useFull,
  onFormationChange,
  onBudgetChange,
  onUseFullChange,
  onRun,
}: {
  formationId: string;
  budgetM: string;
  useFull: boolean;
  onFormationChange: (id: string) => void;
  onBudgetChange: (v: string) => void;
  onUseFullChange: (v: boolean) => void;
  onRun: () => void;
}) {
  return (
    <div className="brief">
      <div className="field">
        <label htmlFor="assist-formation">Formation</label>
        <select
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
          id="assist-budget"
          type="number"
          min={0}
          value={budgetM}
          onChange={(e) => onBudgetChange(e.target.value)}
          style={{ minWidth: 110 }}
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
