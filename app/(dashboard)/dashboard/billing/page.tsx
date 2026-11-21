import Link from "next/link";
import { redirect } from "next/navigation";
import { BillingManager } from "@/components/billing/BillingManager";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SetupRequired } from "@/components/setup/SetupRequired";
import { getSubscription, listOrders } from "@/lib/billing/orders";
import { getPlan } from "@/lib/plans";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getFreshProfile } from "@/lib/usage/quota";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  if (!hasSupabasePublicEnv()) return <SetupRequired />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/dashboard/billing");

  const profile = await getFreshProfile(supabase, user.id);
  const plan = getPlan(profile.plan);
  const subscription = await getSubscription(user.id);
  const orders = await listOrders(user.id);
  const params = await searchParams;

  return (
    <DashboardShell email={user.email}>
      <div className="space-y-6">
        <div>
          <Link href="/dashboard" className="text-sm text-brand-700 hover:underline">
            ← 我的文件
          </Link>
          <h1 className="mt-3 font-display text-3xl font-bold text-slate-900">訂閱管理</h1>
          <p className="mt-2 text-sm text-slate-600">
            查看方案、本月額度與測試付款紀錄。每月用量會依台北時區自動重置。
          </p>
        </div>

        {params.upgraded === "1" && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            測試付款成功，會員方案已更新為 {plan.name}。
          </p>
        )}

        <BillingManager
          planName={plan.name}
          planId={profile.plan}
          documentsUsed={profile.documents_used}
          documentsLimit={plan.documentsPerMonth}
          questionsUsed={profile.questions_used}
          questionsLimit={plan.questionsPerMonth}
          period={profile.usage_period}
          subscriptionStatus={subscription?.status || "active"}
          periodEnd={subscription?.current_period_end || null}
          orders={orders}
        />
      </div>
    </DashboardShell>
  );
}
