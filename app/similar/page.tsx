import { Suspense } from "react";
import { Masthead } from "@/components/kit/Masthead";
import { SimilarView } from "@/components/SimilarView";

export default function SimilarPage() {
  return (
    <div className="wrap">
      <Masthead current="scout" />
      <Suspense fallback={<div className="empty">Setting the page…</div>}>
        <SimilarView />
      </Suspense>
    </div>
  );
}
