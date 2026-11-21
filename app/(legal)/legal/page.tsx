import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "法律資訊",
  description: `${SITE_NAME} 法律資訊入口。`,
};

export default function LegalIndexPage() {
  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          法律資訊
        </h1>
        <p className="text-sm text-slate-600">
          {SITE_NAME} 為拓新雲端 NovaOS 子品牌。以下為本站文件；完整生態系文件以主站為準。
        </p>
      </header>
      <ul className="space-y-3 text-sm">
        <li>
          <Link className="font-medium text-slate-900 underline-offset-2 hover:underline" href="/terms">
            服務條款
          </Link>
        </li>
        <li>
          <Link className="font-medium text-slate-900 underline-offset-2 hover:underline" href="/privacy">
            隱私權政策
          </Link>
        </li>
        <li>
          <a
            className="font-medium text-slate-900 underline-offset-2 hover:underline"
            href="https://paycheck.com.de/legal"
            target="_blank"
            rel="noopener noreferrer"
          >
            NovaOS 法律中心（總站）
          </a>
        </li>
        <li>
          <a
            className="font-medium text-slate-900 underline-offset-2 hover:underline"
            href="https://paycheck.com.de/refund"
            target="_blank"
            rel="noopener noreferrer"
          >
            付費與退款政策（總站）
          </a>
        </li>
      </ul>
    </article>
  );
}
