"use client";

import Link from "next/link";
import { useState } from "react";
import { Masthead } from "@/components/kit/Masthead";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not send reset email.");
        return;
      }
      setMessage(data.message ?? "Check your inbox for a reset link.");
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
        <h1>Reset password</h1>
        <p>We will email you a link to choose a new password. The link expires in one hour.</p>
      </section>

      <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {error ? <div className="err">{error}</div> : null}
        {message ? <div className="ok">{message}</div> : null}
        <div className="cta-row">
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
          <Link href="/login" className="btn ghost">
            Back to sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
