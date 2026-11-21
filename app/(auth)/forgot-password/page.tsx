import { Suspense } from "react";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = { title: "忘記密碼｜Nova AI Doc" };

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[100svh] max-w-md items-center justify-center px-4">
          <p className="text-sm text-slate-500">載入中…</p>
        </main>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
