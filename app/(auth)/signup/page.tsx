import { redirect } from "next/navigation";
import { hubAuthRedirect } from "@/lib/hub-auth";

export const metadata = { title: "註冊" };

type Sp = { next?: string };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Sp>;
}) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/dashboard";
  redirect(hubAuthRedirect("signup", next));
}
