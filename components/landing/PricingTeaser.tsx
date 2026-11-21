import { ButtonLink } from "@/components/ui/ButtonLink";

export function PricingTeaser() {
  return (
    <section id="pricing" className="relative border-t border-brand-100/80 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            免費開始，需要時再升級
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
            免費版可體驗核心功能；付費版將提供更高上傳額度與進階 AI 能力（下一階段實作）。
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/login" className="px-6 py-3 text-base">
            建立免費帳號
          </ButtonLink>
          <ButtonLink href="/login" variant="secondary" className="px-6 py-3 text-base">
            查看登入頁（即將完成）
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
