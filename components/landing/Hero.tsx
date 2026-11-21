import { SITE_NAME, SITE_TAGLINE } from "@/lib/constants";
import { ButtonLink } from "@/components/ui/ButtonLink";

/**
 * 首頁 Hero：品牌、一句主標、一句說明、CTA、全幅視覺
 */
export function Hero() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden">
      {/* 全幅背景層 */}
      <div className="absolute inset-0 hero-canvas" aria-hidden />
      <div className="absolute inset-0 hero-grid" aria-hidden />
      <div className="hero-orb hero-orb-a" aria-hidden />
      <div className="hero-orb hero-orb-b" aria-hidden />

      {/* 右側文件視覺（桌面為主導視覺平面的一部分） */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[52%] lg:block" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-white/10 to-white/80" />
        <HeroDocumentArt />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-center px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        <div className="max-w-xl">
          <p className="animate-fade-up font-display text-sm font-semibold tracking-[0.18em] text-brand-600 sm:text-base">
            {SITE_NAME}
          </p>

          <h1 className="animate-fade-up animation-delay-100 mt-4 font-display text-4xl font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem]">
            上傳 PDF，立刻獲得
            <span className="mt-1 block text-brand-700 sm:mt-0">
              摘要、問答與複習考題
            </span>
          </h1>

          <p className="animate-fade-up animation-delay-200 mt-5 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg">
            {SITE_TAGLINE}。專為學生與知識工作者設計，讓文件不再只是靜態檔案。
          </p>

          <div className="animate-fade-up animation-delay-300 mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/login" className="px-6 py-3 text-base">
              免費開始
            </ButtonLink>
            <ButtonLink href="#features" variant="secondary" className="px-6 py-3 text-base">
              了解功能
            </ButtonLink>
          </div>
        </div>

        {/* 手機版視覺：維持全幅感，不做成卡片 */}
        <div className="animate-fade-up animation-delay-300 relative mt-12 h-56 sm:h-72 lg:hidden" aria-hidden>
          <HeroDocumentArt mobile />
        </div>
      </div>
    </section>
  );
}

function HeroDocumentArt({ mobile = false }: { mobile?: boolean }) {
  return (
    <svg
      viewBox="0 0 640 720"
      className={
        mobile
          ? "h-full w-full object-contain opacity-95"
          : "absolute right-0 top-1/2 h-[78%] w-auto -translate-y-1/2 opacity-95"
      }
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="文件與 AI 摘要示意"
    >
      <defs>
        <linearGradient id="paper" x1="80" y1="40" x2="520" y2="680" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F4F7FF" />
        </linearGradient>
        <linearGradient id="ink" x1="140" y1="120" x2="460" y2="520" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4C6FFF" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="24" stdDeviation="28" floodColor="#4C6FFF" floodOpacity="0.18" />
        </filter>
      </defs>

      <g filter="url(#softShadow)">
        <rect x="110" y="70" width="380" height="520" rx="28" fill="url(#paper)" stroke="#D9E2FF" />
        <path d="M420 70h20c22 0 40 18 40 40v40H420V70Z" fill="#E8EEFF" />
        <rect x="156" y="140" width="220" height="16" rx="8" fill="url(#ink)" opacity="0.9" />
        <rect x="156" y="178" width="280" height="10" rx="5" fill="#C7D4FF" />
        <rect x="156" y="202" width="260" height="10" rx="5" fill="#D7E0FF" />
        <rect x="156" y="226" width="240" height="10" rx="5" fill="#E0E7FF" />
        <rect x="156" y="270" width="180" height="12" rx="6" fill="url(#ink)" opacity="0.55" />
        <rect x="156" y="300" width="290" height="10" rx="5" fill="#D7E0FF" />
        <rect x="156" y="324" width="270" height="10" rx="5" fill="#E0E7FF" />
        <rect x="156" y="348" width="250" height="10" rx="5" fill="#E8EEFF" />
        <rect x="156" y="392" width="200" height="88" rx="18" fill="#EEF2FF" stroke="#C7D4FF" />
        <rect x="176" y="416" width="140" height="10" rx="5" fill="url(#ink)" opacity="0.7" />
        <rect x="176" y="440" width="160" height="8" rx="4" fill="#C7D4FF" />
      </g>

      <g className="animate-float-slow">
        <rect x="430" y="250" width="150" height="120" rx="24" fill="#FFFFFF" stroke="#D9E2FF" />
        <circle cx="468" cy="290" r="14" fill="url(#ink)" />
        <rect x="492" y="282" width="66" height="8" rx="4" fill="#C7D4FF" />
        <rect x="452" y="318" width="106" height="8" rx="4" fill="#E0E7FF" />
        <rect x="452" y="338" width="86" height="8" rx="4" fill="#E8EEFF" />
      </g>
    </svg>
  );
}
