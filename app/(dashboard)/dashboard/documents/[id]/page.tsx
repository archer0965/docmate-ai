import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AskPanel } from "@/components/dashboard/AskPanel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SetupRequired } from "@/components/setup/SetupRequired";
import { getPlan } from "@/lib/plans";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getFreshProfile } from "@/lib/usage/quota";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function DocumentDetailPage({ params }: Props) {
  if (!hasSupabasePublicEnv()) return <SetupRequired />;

  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/dashboard/documents/${id}`);
  }

  const profile = await getFreshProfile(supabase, user.id);
  const plan = getPlan(profile.plan);

  let documentResult = await supabase
    .from("documents")
    .select(
      "id, title, file_name, file_size, page_count, status, error_message, summary, folder, created_at",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (documentResult.error && /folder/i.test(documentResult.error.message || "")) {
    documentResult = await supabase
      .from("documents")
      .select(
        "id, title, file_name, file_size, page_count, status, error_message, summary, created_at",
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
  }

  const document = documentResult.data;
  if (!document) {
    notFound();
  }

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, role, content, source_pages, created_at")
    .eq("document_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (
    <DashboardShell email={user.email}>
      <div className="space-y-6">
        <div>
          <Link href="/dashboard" className="text-sm text-brand-700 hover:underline">
            ← 回到文件列表
          </Link>
          <h1 className="mt-3 font-display text-3xl font-bold text-slate-900">
            {document.title}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {document.file_name}
            {document.page_count ? ` · ${document.page_count} 頁` : ""} · 狀態：{document.status}
            {"folder" in document && document.folder
              ? ` · 資料夾：${document.folder}`
              : ""}
          </p>
        </div>

        <section className="rounded-2xl border border-brand-100 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-slate-900">AI 摘要</h2>
            {document.summary ? (
              <a
                href={`/api/documents/${document.id}/export`}
                className="rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50"
              >
                匯出摘要（.md）
              </a>
            ) : null}
          </div>
          {document.status === "failed" ? (
            <p className="mt-3 text-sm text-red-600">{document.error_message}</p>
          ) : document.summary ? (
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
              {document.summary}
            </pre>
          ) : (
            <p className="mt-3 text-sm text-slate-500">摘要產生中或尚未完成。</p>
          )}
        </section>

        {document.status === "ready" ? (
          <AskPanel
            documentId={document.id}
            initialMessages={(messages || []).map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              source_pages: m.source_pages || [],
              created_at: m.created_at,
            }))}
            questionsRemaining={plan.questionsPerMonth - profile.questions_used}
          />
        ) : (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            文件尚未就緒，暫時無法提問。
          </p>
        )}
      </div>
    </DashboardShell>
  );
}
