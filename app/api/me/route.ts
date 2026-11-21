import { requireUser } from "@/lib/auth/require-user";
import { jsonError } from "@/lib/errors";
import { getPlan } from "@/lib/plans";
import { getFreshProfile } from "@/lib/usage/quota";
import { NextResponse } from "next/server";

/** GET：目前登入使用者與額度 */
export async function GET() {
  try {
    const { user, supabase } = await requireUser();
    const profile = await getFreshProfile(supabase, user.id);
    const plan = getPlan(profile.plan);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
      },
      profile,
      limits: {
        documentsPerMonth: plan.documentsPerMonth,
        questionsPerMonth: plan.questionsPerMonth,
        maxUploadBytes: plan.maxUploadBytes,
        planName: plan.name,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
