import Link from "next/link";
import { redirect } from "next/navigation";
import { TestCheckoutClient } from "@/components/billing/TestCheckoutClient";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SetupRequired } from "@/components/setup/SetupRequired";
import { getOrderForUser, verifyCheckoutToken } from "@/lib/billing/orders";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ token?: string }>;
};

export default async function CheckoutPage({ params, searchParams }: Props) {
  if (!hasSupabasePublicEnv()) return <SetupRequired />;

  const { orderId } = await params;
  const { token } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/dashboard/billing/checkout/${orderId}`);

  if (!token || !verifyCheckoutToken(orderId, user.id, token)) {
    return (
      <DashboardShell email={user.email}>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="font-display text-xl font-semibold text-red-800">結帳連結無效</h1>
          <p className="mt-2 text-sm text-red-700">簽章驗證失敗，請從升級頁重新建立訂單。</p>
          <Link href="/dashboard/upgrade" className="mt-4 inline-block text-sm text-brand-700 hover:underline">
            回到升級頁
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const order = await getOrderForUser(orderId, user.id);

  return (
    <DashboardShell email={user.email}>
      <TestCheckoutClient
        orderId={order.id}
        token={token}
        targetPlan={order.target_plan}
        amountTwd={order.amount_twd}
        status={order.status}
      />
    </DashboardShell>
  );
}
