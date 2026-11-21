import { requireUser } from "@/lib/auth/require-user";
import { jsonError } from "@/lib/errors";
import { getNovaOsUpgradeUrl } from "@/lib/novaos-hub";
import { NextResponse } from "next/server";

/**
 * Paid plans are billed via NovaOS ECPay.
 * Do not silently force FREE here — that desyncs from hub entitlements.
 */
export async function POST() {
  try {
    await requireUser();
    return NextResponse.json(
      {
        ok: false,
        error:
          "付費方案由拓新雲端 NovaOS 綠界訂閱管理。請至總站訂閱中控取消續訂，勿在此強制降級。",
        hubUrl: getNovaOsUpgradeUrl(),
      },
      { status: 409 }
    );
  } catch (error) {
    return jsonError(error);
  }
}
