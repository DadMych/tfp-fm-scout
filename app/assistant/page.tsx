import { Masthead } from "@/components/kit/Masthead";
import { Assistant } from "@/components/Assistant";

export default function AssistantPage() {
  return (
    <div className="wrap">
      <Masthead current="assistant" />
      <div className="dateline">
        <span>The smart search</span>
        <span>Your squad, analysed — and how to strengthen it</span>
      </div>
      <Assistant />
    </div>
  );
}
