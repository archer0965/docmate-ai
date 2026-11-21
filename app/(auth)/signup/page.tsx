import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;

/**
 * Dedicated signup entry — DocMate auth UI lives on /login with mode toggle.
 * Keep /signup so hub CTAs and bookmarks do not 404.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const raw = searchParams ? await Promise.resolve(searchParams) : {};
  const next = typeof raw.next === "string" ? raw.next : undefined;
  const params = new URLSearchParams({ mode: "signup" });
  if (next) params.set("next", next);
  redirect(`/login?${params.toString()}`);
}
