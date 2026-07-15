import { AppHeader } from "@/components/AppHeader";
import { Assistant } from "@/components/Assistant";

export default function AssistantPage() {
  return (
    <div className="wrap">
      <AppHeader current="assistant" />
      <div className="dateline">
        <span>The smart search</span>
        <span>Your squad, analysed — and how to strengthen it</span>
      </div>
      <Assistant />
    </div>
  );
}
