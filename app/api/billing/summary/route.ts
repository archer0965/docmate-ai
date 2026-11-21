import { requireUser } from "@/lib/auth/require-user";
import { getSubscription, listOrders } from "@/lib/billing/orders";
import { jsonError } from "@/lib/errors";
import { getPlan } from "@/lib/plans";
import { getFreshProfile } from "@/lib/usage/quota";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { user, supabase } = await requireUser();
    const profile = await getFreshProfile(supabase, user.id);
    const plan = getPlan(profile.plan);
    const subscription = await getSubscription(user.id);
    const orders = await listOrders(user.id);

    return NextResponse.json({
      profile,
      plan,
      subscription,
      orders,
      usage: {
        documents: {
          used: profile.documents_used,
          limit: plan.documentsPerMonth,
        },
        questions: {
          used: profile.questions_used,
          limit: plan.questionsPerMonth,
        },
        period: profile.usage_period,
      },
      mode: "test",
    });
  } catch (error) {
    return jsonError(error);
  }
}
