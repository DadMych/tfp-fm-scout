import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap">
      <p className="eyebrow">Not found</p>
      <h1 style={{ fontSize: 42, margin: "0 0 16px" }}>No dossier at this address.</h1>
      <p className="standfirst" style={{ maxWidth: "48ch" }}>
        The player or page you asked for is not in this edition of the desk.
      </p>
      <div className="cta-row" style={{ marginTop: 28 }}>
        <Link className="btn" href="/scout">
          Open the scout desk
        </Link>
        <Link className="btn ghost" href="/">
          Upload
        </Link>
      </div>
    </div>
  );
}
