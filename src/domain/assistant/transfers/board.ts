/**
 * Assembles the full sporting-director board (docs/13-sporting-director.md §8).
 */

import type { AnalysisContext } from "../context.js";
import { buildHealth } from "./health.js";
import { buildSales } from "./sales.js";
import { buildSuccession } from "./succession.js";
import type { TransferBoard } from "./types.js";

const VERDICT_ORDER: Record<string, number> = { "sell-now": 0, "sell-high": 1, release: 2, "loan-out": 3 };

export function buildBoard(ctx: AnalysisContext): TransferBoard {
  const all = buildSales(ctx);
  const succession = buildSuccession(ctx);
  const health = buildHealth(ctx, succession);

  const sales = all
    .filter((s) => s.verdict in VERDICT_ORDER)
    .slice()
    .sort(
      (a, b) => VERDICT_ORDER[a.verdict]! - VERDICT_ORDER[b.verdict]! || (b.priceBand?.ask ?? 0) - (a.priceBand?.ask ?? 0),
    );

  const expectedIncome = sales.reduce((sum, s) => sum + (s.priceBand?.ask ?? 0), 0);

  return { sales, all, succession, health, expectedIncome };
}
