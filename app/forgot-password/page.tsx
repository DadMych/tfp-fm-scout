import { Suspense } from "react";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="wrap">Loading…</div>}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
