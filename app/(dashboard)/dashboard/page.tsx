import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DocumentList } from "@/components/dashboard/DocumentList";
import { UploadPanel } from "@/components/dashboard/UploadPanel";
import { SetupRequired } from "@/components/setup/SetupRequired";
import { getPlan } from "@/lib/plans";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getFreshProfile } from "@/lib/usage/quota";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!hasSupabasePublicEnv()) return <SetupRequired />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const profile = await getFreshProfile(supabase, user.id);
  const plan = getPlan(profile.plan);

  // RLS：本人 + 團隊共享（team_id 尚未 migration 時後備）
  let list: {
    id: string;
    title: string;
    file_name: string;
    file_size: number | null;
    status: string;
    page_count: number | null;
    created_at: string;
    error_message: string | null;
    team_id?: string | null;
    isOwner?: boolean;
    shared?: boolean;
  }[] = [];

  const { data: documents, error: docsError } = await supabase
    .from("documents")
    .select(
      "id, title, file_name, file_size, status, page_count, created_at, error_message, team_id, user_id",
    )
    .order("created_at", { ascending: false });

  if (docsError) {
    const { data: fallback } = await supabase
      .from("documents")
      .select(
        "id, title, file_name, file_size, status, page_count, created_at, error_message",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    list = (fallback || []).map((d) => ({ ...d, isOwner: true, shared: false }));
  } else {
    list = (documents || []).map((d) => ({
      ...d,
      isOwner: d.user_id === user.id,
      shared: Boolean(d.team_id) && d.user_id !== user.id,
    }));
  }

  return (
    <DashboardShell email={user.email}>
      <div className="space-y-8">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-900">文件管理中心</h1>
            <p className="mt-2 text-sm text-slate-600">
              目前方案：{plan.name} · 文件 {profile.documents_used}/{plan.documentsPerMonth} ·
              提問 {profile.questions_used}/{plan.questionsPerMonth}（週期 {profile.usage_period}）
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href="/dashboard/workspace"
              className="rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700"
            >
              開啟 AI 工作區
            </Link>
            <Link
              href="/dashboard/teams"
              className="rounded-xl border border-brand-200 px-4 py-2 font-semibold text-brand-800 hover:bg-brand-50"
            >
              團隊
            </Link>
            <Link
              href="/dashboard/upgrade"
              className="rounded-xl border border-brand-200 px-4 py-2 font-semibold text-brand-800 hover:bg-brand-50"
            >
              升級方案
            </Link>
          </div>
        </section>

        <UploadPanel
          maxUploadBytes={plan.maxUploadBytes}
          documentsRemaining={plan.documentsPerMonth - profile.documents_used}
        />

        <section>
          <h2 className="mb-3 font-display text-xl font-semibold text-slate-900">我的文件</h2>
          <DocumentList documents={list} />
        </section>
      </div>
    </DashboardShell>
  );
}
