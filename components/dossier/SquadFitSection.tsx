import type { SquadFitResult } from "@/src/domain/scouting/fit.js";
import { formatMoney } from "@/src/report/format.js";
import { Dateline } from "@/components/kit/Dateline";
import { SectionRule } from "@/components/kit/SectionRule";
import { Stamp, type StampTone } from "@/components/kit/Stamp";

function fitStampTone(verdict: SquadFitResult["verdict"]): StampTone | undefined {
  if (verdict === "Upgrade") return "gold";
  if (verdict === "Not for you") return "ink";
  return undefined;
}

function fitDetail(fit: SquadFitResult): string {
  const parts = [`Best slot ${fit.slotLabel} at ${fit.pairScore} pair fit.`];
  if (fit.incumbentName) {
    parts.push(
      `Incumbent ${fit.incumbentName}${fit.incumbentFit != null ? ` (${fit.incumbentFit})` : ""}.`,
    );
  }
  if (fit.delta != null) {
    parts.push(`Delta ${fit.delta >= 0 ? "+" : ""}${fit.delta}.`);
  }
  return parts.join(" ");
}

export function SquadFitSection({
  fit,
  formationId,
  budget,
  useFull,
}: {
  fit: SquadFitResult;
  formationId: string;
  budget: number;
  useFull: boolean;
}) {
  const budgetLabel = useFull ? "Unlimited budget" : `${formatMoney(budget)} cap`;
  const tone = fitStampTone(fit.verdict);

  return (
    <>
      <SectionRule gap="lg">Where he fits your side</SectionRule>
      <Dateline left={`Assessed against your ${formationId}`} right={budgetLabel} />
      <div className={`callout ${fit.verdict === "Upgrade" ? "callout-gold" : ""}`}>
        {tone ? <Stamp tone={tone}>{fit.verdict}</Stamp> : <Stamp>{fit.verdict}</Stamp>}
        <p className="c-head">{fit.headline}</p>
        <p className="c-detail">{fitDetail(fit)}</p>
      </div>
    </>
  );
}
