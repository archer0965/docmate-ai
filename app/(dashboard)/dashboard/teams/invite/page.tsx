import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AcceptInviteClient } from "@/components/teams/AcceptInviteClient";
import { SetupRequired } from "@/components/setup/SetupRequired";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ token?: string }> };

export default async function AcceptInvitePage({ searchParams }: Props) {
  if (!hasSupabasePublicEnv()) return <SetupRequired />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { token } = await searchParams;
  const next = `/dashboard/teams/invite${token ? `?token=${encodeURIComponent(token)}` : ""}`;

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <DashboardShell email={user.email}>
      <AcceptInviteClient token={token || ""} />
    </DashboardShell>
  );
}
