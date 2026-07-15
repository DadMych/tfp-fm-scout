import type { Insight } from "@/src/domain/assistant/types.js";
import { InsightRow } from "./InsightRow";
import { FEED_COLLAPSED_COUNT, FEED_LABEL, type FeedGroup } from "./shared";

export function FindingsFeed({
  findings,
  visibleGroups,
  activeGroup,
  groupCount,
  feed,
  feedAll,
  feedExpanded,
  onGroupChange,
  onExpand,
  nameById,
  onFormation,
}: {
  findings: readonly Insight[];
  visibleGroups: readonly FeedGroup[];
  activeGroup: FeedGroup;
  groupCount: (g: FeedGroup) => number;
  feed: readonly Insight[];
  feedAll: readonly Insight[];
  feedExpanded: boolean;
  onGroupChange: (g: FeedGroup) => void;
  onExpand: () => void;
  nameById: Map<string, import("@/src/domain/player.js").Player>;
  onFormation: (id: string) => void;
}) {
  return (
    <>
      <div className="section-label section-gap">Scouting report ({findings.length} findings)</div>
      {visibleGroups.length > 2 ? (
        <div className="feed-tabs" role="tablist">
          {visibleGroups.map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={activeGroup === g}
              className={activeGroup === g ? "on" : ""}
              onClick={() => onGroupChange(g)}
            >
              {FEED_LABEL[g]} ({groupCount(g)})
            </button>
          ))}
        </div>
      ) : null}
      <ul className="insight-feed">
        {feed.map((i) => (
          <InsightRow key={i.id} insight={i} nameById={nameById} onFormation={onFormation} />
        ))}
        {feed.length === 0 ? <li className="lede">Nothing here — good news.</li> : null}
      </ul>
      {!feedExpanded && feedAll.length > FEED_COLLAPSED_COUNT ? (
        <button type="button" className="show-all-btn" onClick={onExpand}>
          Show all {feedAll.length} findings
        </button>
      ) : null}
    </>
  );
}
