import { AppHeader } from "@/components/AppHeader";
import { ScoutDesk } from "@/components/ScoutDesk";

export default function ScoutPage() {
  return (
    <div className="wrap">
      <AppHeader current="scout" />
      <div className="dateline">
        <span>The scout desk</span>
        <span>Recommendations from your database</span>
      </div>
      <ScoutDesk />
    </div>
  );
}
