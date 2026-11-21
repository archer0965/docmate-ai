import { FeaturePreview } from "@/components/landing/FeaturePreview";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { PricingTeaser } from "@/components/landing/PricingTeaser";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";

/**
 * 首頁（本階段完成）
 * 下一階段：登入、儀表板、上傳與 AI 功能
 */
export default function HomePage() {
  return (
    <main>
      <SiteHeader />
      <Hero />
      <FeaturePreview />
      <HowItWorks />
      <PricingTeaser />
      <SiteFooter />
    </main>
  );
}
