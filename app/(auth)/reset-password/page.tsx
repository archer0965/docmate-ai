import { Suspense } from "react";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "重設密碼｜Nova AI Doc" };

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[100svh] max-w-md items-center justify-center px-4">
          <p className="text-sm text-slate-500">載入中…</p>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
