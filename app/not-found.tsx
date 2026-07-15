import Link from "next/link";
import { EmptyBroadsheet } from "@/components/kit/EmptyBroadsheet";

export default function NotFound() {
  return (
    <div className="wrap">
      <EmptyBroadsheet
        art="lost-ball"
        artWidth={160}
        eyebrow="Not found"
        title="No dossier at this address."
        actions={
          <>
            <Link className="btn" href="/scout">
              Open the scout desk
            </Link>
            <Link className="btn ghost" href="/">
              Upload
            </Link>
          </>
        }
      >
        <p>The player or page you asked for is not in this edition of the desk.</p>
      </EmptyBroadsheet>
    </div>
  );
}
