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

  const { data: documents } = await supabase
    .from("documents")
    .select(
      "id, title, file_name, file_size, page_count, status, error_message, summary, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <WorkspaceApp
      documents={(documents || []) as DocumentRecord[]}
      initialDocId={docParam || null}
      questionsRemaining={Math.max(plan.questionsPerMonth - profile.questions_used, 0)}
      documentsRemaining={Math.max(plan.documentsPerMonth - profile.documents_used, 0)}
      maxUploadBytes={plan.maxUploadBytes}
      planName={plan.name}
      usageLabel={`文件 ${profile.documents_used}/${plan.documentsPerMonth} · 提問 ${profile.questions_used}/${plan.questionsPerMonth}`}
    />
  );
}
