import { Masthead } from "@/components/kit/Masthead";
import { ScoutDesk } from "@/components/ScoutDesk";

export default function ScoutPage() {
  return (
    <div className="wrap">
      <Masthead current="scout" />
      <div className="dateline">
        <span>The scout desk</span>
        <span>Recommendations from your database</span>
      </div>
      <ScoutDesk />
    </div>
  );
}
