"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { clearClientStorage, loadClientStorage } from "@/lib/client-storage";
import {
  clientSnapshotEmpty,
  importLocalToHosted,
  loadHostedStorage,
} from "@/lib/hosted-storage";

const DISMISS_KEY = "tfp.migration.dismissed";

export function LocalMigrationPrompt() {
  const { data: session, status } = useSession();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;

    let cancelled = false;
    void (async () => {
      try {
        const local = await loadClientStorage();
        if (clientSnapshotEmpty(local)) return;
        const hosted = await loadHostedStorage();
        if (!clientSnapshotEmpty(hosted)) return;
        if (!cancelled) setVisible(true);
      } catch {
        // Offer nothing if we cannot read local/browser state.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id]);

  const isAuthed = status === "authenticated" && Boolean(session?.user?.id);
  if (!visible || !isAuthed) return null;

  async function upload() {
    setError(null);
    setBusy(true);
    try {
      const local = await loadClientStorage();
      await importLocalToHosted(local);
      await clearClientStorage();
      sessionStorage.setItem(DISMISS_KEY, "1");
      window.location.reload();
    } catch {
      setError("Could not copy your browser data to the account. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="migration-banner" role="status">
      <p>
        You have scouting data saved in this browser. Copy it to your account so it follows you
        across devices?
      </p>
      <div className="cta-row">
        <button type="button" className="btn" disabled={busy} onClick={() => void upload()}>
          {busy ? "Copying…" : "Copy to my account"}
        </button>
        <button type="button" className="btn ghost" disabled={busy} onClick={dismiss}>
          Not now
        </button>
      </div>
      {error ? <div className="err">{error}</div> : null}
    </div>
  );
}
