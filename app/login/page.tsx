import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="wrap">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
