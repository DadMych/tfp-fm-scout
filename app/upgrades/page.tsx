import { Suspense } from "react";
import { Masthead } from "@/components/kit/Masthead";
import { UpgradesView } from "@/components/UpgradesView";

export default function UpgradesPage() {
  return (
    <div className="wrap">
      <Masthead current="scout" />
      <Suspense fallback={<div className="empty">Setting the page…</div>}>
        <UpgradesView />
      </Suspense>
    </div>
  );
}
