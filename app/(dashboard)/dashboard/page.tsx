import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DocumentList } from "@/components/dashboard/DocumentList";
import { UploadPanel } from "@/components/dashboard/UploadPanel";
import { getPlan } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { getFreshProfile } from "@/lib/usage/quota";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const profile = await getFreshProfile(supabase, user.id);
  const plan = getPlan(profile.plan);

  const { data: documents } = await supabase
    .from("documents")
    .select("id, title, file_name, status, page_count, created_at, error_message")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <DashboardShell email={user.email}>
      <div className="space-y-8">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-900">我的文件</h1>
            <p className="mt-2 text-sm text-slate-600">
              目前方案：{plan.name} · 文件 {profile.documents_used}/{plan.documentsPerMonth} ·
              提問 {profile.questions_used}/{plan.questionsPerMonth}（週期 {profile.usage_period}）
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <Link
              href="/dashboard/upgrade"
              className="rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700"
            >
              升級方案
            </Link>
            <Link
              href="/dashboard/billing"
              className="rounded-xl border border-brand-200 px-4 py-2 font-semibold text-brand-800 hover:bg-brand-50"
            >
              訂閱管理
            </Link>
          </div>
        </section>

        <UploadPanel
          maxUploadBytes={plan.maxUploadBytes}
          documentsRemaining={plan.documentsPerMonth - profile.documents_used}
        />

        <section>
          <h2 className="mb-3 font-display text-xl font-semibold text-slate-900">文件列表</h2>
          <DocumentList documents={documents || []} />
        </section>
      </div>
    </DashboardShell>
  );
}
