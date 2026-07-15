import { Suspense } from "react";
import { Masthead } from "@/components/kit/Masthead";
import { CompareView } from "@/components/CompareView";

export default function ComparePage() {
  return (
    <div className="wrap">
      <Masthead current="scout" />
      <Suspense fallback={<div className="empty">Setting the page…</div>}>
        <CompareView />
      </Suspense>
    </div>
  );
}
