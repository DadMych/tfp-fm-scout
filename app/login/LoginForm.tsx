"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Masthead } from "@/components/kit/Masthead";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const callbackUrl = params.get("callbackUrl") ?? "/";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name: name || undefined }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setError(data.error ?? "Could not create account.");
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });
      if (result?.error) {
        setError(mode === "register" ? "Account created, but sign-in failed." : "Invalid email or password.");
        return;
      }
      router.push(callbackUrl);
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
        <h1>{mode === "signin" ? "Sign in" : "Create account"}</h1>
        <p>
          Save your shortlist and watch list across devices. Without an account, everything stays in
          your browser as today.
        </p>
      </section>

      <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
        {mode === "register" ? (
          <label>
            Name <span className="hint">optional</span>
            <input
              type="text"
              className="control control--lg"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        ) : null}
        <label>
          Email
          <input
            type="email"
            className="control control--lg"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password <span className="hint">8+ characters</span>
          <input
            type="password"
            className="control control--lg"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <div className="err">{error}</div> : null}
        <div className="cta-row">
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setMode(mode === "signin" ? "register" : "signin");
              setError(null);
            }}
          >
            {mode === "signin" ? "Need an account?" : "Already registered?"}
          </button>
        </div>
      </form>

      <div className="auth-divider">or</div>

      <div className="cta-row">
        <button
          type="button"
          className="btn ghost"
          onClick={() => void signIn("google", { callbackUrl })}
        >
          Continue with Google
        </button>
        <Link href="/" className="btn ghost">
          Stay logged out →
        </Link>
      </div>
    </div>
  );
}
