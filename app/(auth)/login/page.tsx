import { redirect } from "next/navigation";
import { hubAuthRedirect } from "@/lib/hub-auth";

export const metadata = { title: "登入" };

type Sp = { next?: string; mode?: string };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Sp>;
}) {
  const sp = await searchParams;
  const mode = sp.mode === "signup" ? "signup" : "login";
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/dashboard";
  redirect(hubAuthRedirect(mode, next));
}
