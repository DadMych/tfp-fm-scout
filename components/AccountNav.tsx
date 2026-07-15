"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export function AccountNav() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <Link href="/login">Account</Link>;
  }

  if (session?.user) {
    return (
      <button
        type="button"
        className="mast-link-btn"
        onClick={() => void signOut({ callbackUrl: "/" })}
      >
        Sign out
      </button>
    );
  }

  return <Link href="/login">Account</Link>;
}
