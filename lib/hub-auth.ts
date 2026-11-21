import { NOVAOS_HUB_URL } from "@/lib/novaos-hub";
import { SITE_URL } from "@/lib/constants";

export function hubAuthRedirect(
  mode: "login" | "signup",
  nextPath = "/dashboard"
): string {
  const next = nextPath.startsWith("/") ? nextPath : "/dashboard";
  const origin = SITE_URL.replace(/\/$/, "");
  const returnTo = `${origin}/auth/receive?next=${encodeURIComponent(next)}`;
  return `${NOVAOS_HUB_URL}/${mode}?next=${encodeURIComponent(returnTo)}`;
}
