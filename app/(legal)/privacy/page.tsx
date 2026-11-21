import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "隱私權政策",
  description: `${SITE_NAME} 隱私權政策：個資蒐集、使用與當事人權利。`,
};

export default function PrivacyPage() {
  return (
    <article className="prose prose-slate max-w-none prose-headings:font-display">
      <h1>隱私權政策</h1>
      <p className="lead text-slate-600">
        本政策說明 {SITE_NAME}{" "}
        如何處理個人資料。生態系統一說明見{" "}
        <a
          href="https://paycheck.com.de/privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          NovaOS 隱私權政策
        </a>
        。
      </p>

      <h2>1. 蒐集項目</h2>
      <ul>
        <li>帳號資料：Email、顯示名稱、方案與用量紀錄。</li>
        <li>文件資料：您上傳之 PDF 與衍生摘要／問答紀錄。</li>
        <li>技術資料：登入與操作日誌、裝置／瀏覽器類型（安全與除錯用途）。</li>
        <li>付款結果：經主站綠界回傳之交易狀態與必要訂單資訊（不含完整卡號）。</li>
      </ul>

      <h2>2. 利用目的</h2>
      <p>
        提供文件 AI 服務、帳號與額度管理、客服、資安防護、法令遵循及服務改善。不會將您的文件用於與服務無關之對外行銷。
      </p>

      <h2>3. 第三方</h2>
      <p>
        可能使用 Supabase（帳號／資料庫）、Google Gemini（AI
        推論）、拓新雲端主站與綠界（付費）等。僅在提供服務必要範圍內傳輸。
      </p>

      <h2>4. 當事人權利</h2>
      <p>
        您得依法請求查詢、閱覽、製給複製本、補充更正、停止蒐集處理利用或刪除。請透過{" "}
        <a href="https://paycheck.com.de/contact" target="_blank" rel="noopener noreferrer">
          NovaOS 聯絡入口
        </a>{" "}
        提出。
      </p>

      <p>
        <Link href="/terms">服務條款</Link>
        {" · "}
        <Link href="/legal">法律資訊</Link>
      </p>
    </article>
  );
}
