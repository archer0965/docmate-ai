import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "服務條款",
  description: `${SITE_NAME} 服務條款：帳號規範、服務範圍與準據法。`,
};

export default function TermsPage() {
  return (
    <article className="prose prose-slate max-w-none prose-headings:font-display">
      <h1>服務條款</h1>
      <p className="lead text-slate-600">
        適用於 {SITE_NAME}（拓新雲端 NovaOS 子品牌）。更完整的生態系條款請見{" "}
        <a
          href="https://paycheck.com.de/terms"
          target="_blank"
          rel="noopener noreferrer"
        >
          NovaOS 服務條款
        </a>
        。
      </p>

      <h2>1. 接受條款</h2>
      <p>
        您註冊、登入或使用本服務，即表示同意本條款及 NovaOS
        總站相關法律文件。若不同意，請停止使用。
      </p>

      <h2>2. 服務說明</h2>
      <ul>
        <li>
          本服務提供 PDF 上傳、摘要、文件問答與相關 AI
          輔助功能，屬系統輔助，不構成專業顧問意見。
        </li>
        <li>
          AI 產出可能有誤，重要決策請自行核對原文。用量與方案以站上定價與帳號額度為準。
        </li>
        <li>
          付費升級經拓新雲端主站綠界（ECPay）結帳；權益以主站付款回調結果為準。
        </li>
      </ul>

      <h2>3. 帳號與資料</h2>
      <ul>
        <li>請妥善保管登入憑證；不得分享帳號或濫用 API／額度。</li>
        <li>
          您上傳之文件僅供您的帳號使用；請勿上傳無權處理之機密或違法內容。
        </li>
        <li>我們得於安全或法規必要時暫停服務或刪除違規內容。</li>
      </ul>

      <h2>4. 準據法</h2>
      <p>
        本條款以中華民國法令為準據法。爭議優先以誠信協商處理；協商不成時，以臺灣臺北地方法院為第一審管轄法院。
      </p>

      <p>
        <Link href="/privacy">隱私權政策</Link>
        {" · "}
        <Link href="/legal">法律資訊</Link>
        {" · "}
        <Link href="/login">登入</Link>
      </p>
    </article>
  );
}
