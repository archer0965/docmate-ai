import Link from "next/link";
import { redirect } from "next/navigation";
import { UpgradePlans } from "@/components/billing/UpgradePlans";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PLANS } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { getFreshProfile } from "@/lib/usage/quota";

export const dynamic = "force-dynamic";

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ failed?: string }>;
}) {
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
            選擇適合的方案。測試金流不會真正扣款；權限只在伺服器驗證付款後更新。
          </p>
        </div>

        {params.failed === "1" && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            測試付款未成功，方案未變更。
          </p>
        )}

        <UpgradePlans currentPlan={profile.plan} plans={plans} />
      </div>
    </DashboardShell>
  );
}
