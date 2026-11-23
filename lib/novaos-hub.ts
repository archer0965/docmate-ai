import { SITE_URL } from "@/lib/constants";

/** 拓新雲端主站（統一綠界金流入口） */
export const NOVAOS_HUB_URL =
  process.env.NEXT_PUBLIC_NOVAOS_URL?.replace(/\/$/, "") ||
  "https://paycheck.com.de";

export const NOVAOS_LEGAL_URL = `${NOVAOS_HUB_URL}/legal`;

export const NOVAOS_BILLING_PATH = "/dashboard/pass#upgrade";

const PRODUCT = "docmate";

function toLocalPath(returnTo: string): string {
  if (returnTo.startsWith("http://") || returnTo.startsWith("https://")) {
    try {
      const u = new URL(returnTo);
      return `${u.pathname}${u.search}` || "/dashboard";
    } catch {
      return "/dashboard";
    }
  }
  return returnTo.startsWith("/") ? returnTo : `/${returnTo}`;
}

/** Build absolute product receive URL for hub `?next=`. */
export function toReceiveReturnUrl(returnTo = "/dashboard"): string {
  const path = toLocalPath(returnTo);
  const origin = SITE_URL.replace(/\/$/, "");
  return `${origin}/auth/receive?next=${encodeURIComponent(path)}`;
}

/**
 * 付費升級：導向主站登入 → 訂閱中控（綠界 ECPay）
 */
export function getNovaOsUpgradeUrl(): string {
  const next = encodeURIComponent(NOVAOS_BILLING_PATH);
  return `${NOVAOS_HUB_URL}/login?next=${next}&product=${PRODUCT}`;
}

/** Unified auth entry — always NovaOS hub login; return via /auth/receive. */
export function getNovaOsLoginUrl(returnTo = "/dashboard"): string {
  const receive = toReceiveReturnUrl(returnTo);
  return `${NOVAOS_HUB_URL}/login?next=${encodeURIComponent(receive)}&product=${PRODUCT}`;
}

export function getNovaOsSignupUrl(returnTo = "/dashboard"): string {
  const receive = toReceiveReturnUrl(returnTo);
  return `${NOVAOS_HUB_URL}/signup?next=${encodeURIComponent(receive)}&product=${PRODUCT}`;
}
