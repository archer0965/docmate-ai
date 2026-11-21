import { NextResponse } from "next/server";

/**
 * 部署健康檢查（不回傳任何密鑰）
 */
export async function GET() {
  const hasSupabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  const hasBillingSecret = Boolean(process.env.BILLING_TEST_SECRET);

  return NextResponse.json({
    ok: true,
    service: "docmate-ai",
    env: {
      supabasePublic: hasSupabase,
      supabaseServiceRole: hasServiceRole,
      gemini: hasGemini,
      billingSecret: hasBillingSecret,
    },
  });
}
