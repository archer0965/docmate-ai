import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { TeamsManager } from "@/components/teams/TeamsManager";
import { SetupRequired } from "@/components/setup/SetupRequired";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getFreshProfile } from "@/lib/usage/quota";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  if (!hasSupabasePublicEnv()) return <SetupRequired />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/teams");
  }

  const profile = await getFreshProfile(supabase, user.id);

  return (
    <DashboardShell email={user.email}>
      <div className="space-y-6">
        <section>
          <h1 className="font-display text-3xl font-bold text-slate-900">團隊</h1>
          <p className="mt-2 text-sm text-slate-600">
            商業版可建立團隊、邀請成員並共享文件。被邀請者不需升級亦可存取共享文件。
          </p>
        </section>
        <TeamsManager
          isBusiness={profile.plan === "business"}
          currentUserId={user.id}
        />
      </div>
    </DashboardShell>
  );
}
