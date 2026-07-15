"use client";

import { EmptyBroadsheet } from "@/components/kit/EmptyBroadsheet";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="wrap">
      <EmptyBroadsheet
        art="lost-ball"
        artWidth={160}
        eyebrow="Something went wrong"
        title="The page could not be set."
        actions={
          <>
            <button type="button" className="btn" onClick={() => reset()}>
              Try again
            </button>
            <a className="btn ghost" href="/">
              Back to upload
            </a>
          </>
        }
      >
        <p>
          An unexpected fault stopped this screen from loading. Your uploaded datasets are still in
          the browser unless you cleared site data.
        </p>
      </EmptyBroadsheet>
    </div>
  );
}
