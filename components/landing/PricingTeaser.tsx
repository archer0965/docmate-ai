import { ButtonLink } from "@/components/ui/ButtonLink";
import { PLANS } from "@/lib/plans";

export function PricingTeaser() {
  return (
    <section id="pricing" className="relative border-t border-brand-100/80 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            免費開始，需要時再升級
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
            FREE 每月 {PLANS.free.documentsPerMonth} 份文件／{PLANS.free.questionsPerMonth} 次提問；
            PRO NT${PLANS.pro.priceTwd}；Business NT${PLANS.business.priceTwd}。
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/login" className="px-6 py-3 text-base">
            建立免費帳號
          </ButtonLink>
          <ButtonLink href="/login?next=/dashboard/upgrade" variant="secondary" className="px-6 py-3 text-base">
            查看方案
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
