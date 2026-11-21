import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[100svh] max-w-md items-center justify-center px-4">
          <p className="text-sm text-slate-500">載入登入頁…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
