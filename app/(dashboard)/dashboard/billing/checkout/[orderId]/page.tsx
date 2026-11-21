import { redirect } from "next/navigation";
import { getNovaOsUpgradeUrl } from "@/lib/novaos-hub";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/setup/SetupRequired";

export const dynamic = "force-dynamic";

/**
 * 舊測試結帳路徑：一律導向拓新雲端綠界升級頁
 */
export default async function CheckoutPage() {
  if (!hasSupabasePublicEnv()) return <SetupRequired />;
  redirect(getNovaOsUpgradeUrl());
}
