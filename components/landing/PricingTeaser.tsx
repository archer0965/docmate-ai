import { ButtonLink } from "@/components/ui/ButtonLink";
import { PLANS } from "@/lib/plans";
import { getNovaOsUpgradeUrl } from "@/lib/novaos-hub";

const ORDER = ["free", "pro", "business"] as const;

export function PricingTeaser() {
  return (
    <section
      id="pricing"
      className="relative border-t border-brand-100/80 bg-white py-20 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            獨立定價，與全站同享優惠
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
            FREE／PRO NT$199／BUSINESS NT$499。付費升級統一綠界
            ECPay，並套用拓新雲端早鳥／一般／大使折扣。
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {ORDER.map((id) => {
            const plan = PLANS[id];
            return (
              <article
                key={id}
                className={`rounded-2xl border p-6 ${
                  plan.isPopular
                    ? "border-brand-300 bg-gradient-to-b from-brand-50 to-white shadow-soft"
                    : "border-brand-100 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-xl font-semibold text-slate-900">
                    {plan.name}
                  </h3>
                  {plan.isPopular ? (
                    <span className="rounded-md bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {plan.popularBadge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-500">{plan.blurb}</p>
                <p className="mt-4 font-display text-3xl font-bold text-slate-900">
                  {plan.priceTwd === 0 ? "免費" : `NT$${plan.priceTwd}`}
                  {plan.priceTwd > 0 ? (
                    <span className="text-sm font-medium text-slate-500">
                      {" "}
                      / 月
                    </span>
                  ) : null}
                </p>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/login" className="px-6 py-3 text-base">
            免費體驗
          </ButtonLink>
          <ButtonLink
            href={getNovaOsUpgradeUrl()}
            variant="secondary"
            className="px-6 py-3 text-base"
          >
            綠界付款升級
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
