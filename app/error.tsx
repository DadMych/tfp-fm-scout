"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="wrap">
      <p className="eyebrow">Something went wrong</p>
      <h1 style={{ fontSize: 42, margin: "0 0 16px" }}>The page could not be set.</h1>
      <p className="standfirst" style={{ maxWidth: "48ch" }}>
        An unexpected fault stopped this screen from loading. Your uploaded datasets are still in
        the browser unless you cleared site data.
      </p>
      <div className="cta-row" style={{ marginTop: 28 }}>
        <button type="button" className="btn" onClick={() => reset()}>
          Try again
        </button>
        <a className="btn ghost" href="/">
          Back to upload
        </a>
      </div>
    </div>
  );
}
