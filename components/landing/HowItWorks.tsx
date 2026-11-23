const STEPS = [
  { title: "上傳 PDF", detail: "把講義、報告或研究文件放到 Nova AI Doc。" },
  { title: "AI 整理重點", detail: "自動產生摘要，並支援依頁碼引用的問答。" },
  { title: "對話與複習", detail: "隨時針對文件提問，把知識真正學會。" },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative bg-gradient-to-b from-brand-50/70 to-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            三步驟開始使用
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
            流程刻意保持簡單，方便初學者也能快速上手。
          </p>
        </div>

        <ol className="mt-12 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 font-display text-sm font-bold text-white">
                {index + 1}
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">{step.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
