const FEATURES = [
  {
    title: "AI 文件摘要",
    description: "上傳 PDF 後，快速整理重點，節省閱讀時間。",
  },
  {
    title: "智慧問答",
    description: "針對文件內容提問，取得清楚、可追溯的回答。",
  },
  {
    title: "來源頁碼引用",
    description: "回答附上引用頁碼，方便回到原文核對。",
  },
] as const;

/**
 * 首屏以下的簡短功能預覽（下一階段再擴充完整功能頁）
 */
export function FeaturePreview() {
  return (
    <section id="features" className="relative border-t border-brand-100/80 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            一份文件，多種學習方式
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
            Nova AI Doc 幫你把靜態 PDF 轉成可摘要、可對話、可追溯引用的工作流程。
          </p>
        </div>

        <ul className="mt-12 grid gap-10 sm:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <li key={feature.title} className="relative">
              <p className="font-display text-sm font-semibold tracking-[0.16em] text-brand-500">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-3 font-display text-xl font-semibold text-slate-900">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
                {feature.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
