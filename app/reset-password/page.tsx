import { Suspense } from "react";
import ResetPasswordForm from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="wrap">Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
