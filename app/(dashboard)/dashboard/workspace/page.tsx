import { redirect } from "next/navigation";
import { SetupRequired } from "@/components/setup/SetupRequired";
import { WorkspaceApp } from "@/components/workspace/WorkspaceApp";
import { getPlan } from "@/lib/plans";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getFreshProfile } from "@/lib/usage/quota";
import type { DocumentRecord } from "@/types";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ doc?: string }> };

export default async function WorkspacePage({ searchParams }: Props) {
  if (!hasSupabasePublicEnv()) return <SetupRequired />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/workspace");
  }

  const profile = await getFreshProfile(supabase, user.id);
  const plan = getPlan(profile.plan);
  const { doc: docParam } = await searchParams;

  let docs: DocumentRecord[] = [];
  const { data: documents, error: docsError } = await supabase
    .from("documents")
    .select(
      "id, title, file_name, file_size, page_count, status, error_message, summary, created_at, updated_at, team_id, user_id",
    )
    .order("created_at", { ascending: false });

  if (docsError) {
    const { data: fallback } = await supabase
      .from("documents")
      .select(
        "id, title, file_name, file_size, page_count, status, error_message, summary, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    docs = (fallback || []).map((d) => ({ ...d, isOwner: true })) as DocumentRecord[];
  } else {
    docs = (documents || []).map((d) => ({
      ...d,
      isOwner: d.user_id === user.id,
    })) as DocumentRecord[];
  }

  return (
    <WorkspaceApp
      documents={docs}
      initialDocId={docParam || null}
      questionsRemaining={Math.max(plan.questionsPerMonth - profile.questions_used, 0)}
      documentsRemaining={Math.max(plan.documentsPerMonth - profile.documents_used, 0)}
      maxUploadBytes={plan.maxUploadBytes}
      planName={plan.name}
      usageLabel={`文件 ${profile.documents_used}/${plan.documentsPerMonth} · 提問 ${profile.questions_used}/${plan.questionsPerMonth}`}
    />
  );
}
