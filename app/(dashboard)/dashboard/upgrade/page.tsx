import Link from "next/link";
import { redirect } from "next/navigation";
import { UpgradePlans } from "@/components/billing/UpgradePlans";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SetupRequired } from "@/components/setup/SetupRequired";
import { PLANS } from "@/lib/plans";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getFreshProfile } from "@/lib/usage/quota";

export const dynamic = "force-dynamic";

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ failed?: string }>;
}) {
  if (!hasSupabasePublicEnv()) return <SetupRequired />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/dashboard/upgrade");

  const profile = await getFreshProfile(supabase, user.id);
  const params = await searchParams;

  const plans = Object.values(PLANS).map((plan) => ({
    id: plan.id,
    name: plan.name,
    priceTwd: plan.priceTwd,
    documentsPerMonth: plan.documentsPerMonth,
    questionsPerMonth: plan.questionsPerMonth,
    maxUploadMb: Math.floor(plan.maxUploadBytes / (1024 * 1024)),
    blurb: plan.blurb,
    isPopular: plan.isPopular,
    popularBadge: plan.popularBadge,
    features: plan.features,
  }));

  return (
    <DashboardShell email={user.email}>
      <div className="space-y-6">
        <div>
          <Link href="/dashboard/billing" className="text-sm text-brand-700 hover:underline">
            ← 訂閱管理
          </Link>
          <h1 className="mt-3 font-display text-3xl font-bold text-slate-900">升級方案</h1>
          <p className="mt-2 text-sm text-slate-600">
            FREE／專業版 NT$199／商業版 NT$499。付費升級統一導向拓新雲端綠界
            ECPay，折扣規則與全站相同。
          </p>
        </div>

        {params.failed === "1" && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            付款未完成，方案未變更。請重新選擇方案並完成綠界結帳。
          </p>
        )}

        <UpgradePlans currentPlan={profile.plan} plans={plans} />
      </div>
    </DashboardShell>
  );
}
