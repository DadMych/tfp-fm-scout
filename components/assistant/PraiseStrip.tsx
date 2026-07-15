import type { Insight } from "@/src/domain/assistant/types.js";

export function PraiseStrip({ praise }: { praise: readonly Insight[] }) {
  if (praise.length === 0) return null;
  return (
    <>
      <div className="section-label section-gap">What&apos;s working</div>
      <div className="praise-strip">
        {praise.map((i) => (
          <div key={i.id} className="praise-card">
            <div className="ptitle">{i.title}</div>
            <p className="pdetail">{i.detail}</p>
          </div>
        ))}
      </div>
    </>
  );
}
