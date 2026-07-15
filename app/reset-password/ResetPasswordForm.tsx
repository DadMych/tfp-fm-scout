"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Masthead } from "@/components/kit/Masthead";

export default function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("This reset link is invalid. Request a new one.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not reset password.");
        return;
      }
      router.push("/login");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <Masthead current="home" />

      <section className="hero-lead">
        <p className="eyebrow">Account</p>
        <h1>Choose a new password</h1>
        <p>Enter a new password for your account. You can sign in once this is saved.</p>
      </section>

      <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
        <label>
          New password <span className="hint">8+ characters</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <div className="err">{error}</div> : null}
        <div className="cta-row">
          <button type="submit" className="btn" disabled={busy || !token}>
            {busy ? "Saving…" : "Save new password"}
          </button>
          <Link href="/forgot-password" className="btn ghost">
            Request a new link
          </Link>
        </div>
      </form>
    </div>
  );
}
