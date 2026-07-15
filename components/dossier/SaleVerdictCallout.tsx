import type { Player } from "@/src/domain/player.js";
import type { TransferBoard } from "@/src/domain/assistant/transfers/types.js";
import { formatMoney } from "@/src/report/format.js";
import { surname } from "@/src/domain/assistant/phrases.js";
import { Stamp } from "@/components/kit/Stamp";

const VERDICT_LABEL: Record<string, string> = {
  untouchable: "Untouchable",
  "sell-high": "Sell high",
  "sell-now": "Sell now",
  "loan-out": "Loan out",
  release: "Release",
};

/**
 * Sporting-director exit read for a squad player (docs/13-sporting-director.md §11.4).
 */
export function SaleVerdictCallout({ p, board }: { p: Player; board: TransferBoard }) {
  const sale = board.all.find((x) => x.playerId === p.id);
  if (!sale || sale.verdict === "keep") return null;

  const extras = [
    sale.priceBand ? `Ask ${formatMoney(sale.priceBand.ask)}.` : null,
    sale.replacement?.playerId
      ? `Replacement ${surname(sale.replacement.playerName ?? "")} (fit ${sale.replacement.fitAfter}).`
      : null,
  ].filter(Boolean);

  return (
    <div className="callout callout-gold">
      <Stamp tone="gold">{VERDICT_LABEL[sale.verdict] ?? sale.verdict}</Stamp>
      <p className="c-head">{sale.reasons[0] ?? "Flagged by the sporting director."}</p>
      {extras.length > 0 ? <p className="c-detail">{extras.join(" ")}</p> : null}
    </div>
  );
}
