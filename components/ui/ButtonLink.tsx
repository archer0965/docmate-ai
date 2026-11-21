import Link from "next/link";

type ButtonLinkProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
};

/**
 * 簡單的連結按鈕元件
 * 初學者提示：之後儀表板按鈕也可以沿用同樣的樣式類別。
 */
export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: ButtonLinkProps) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

  const variants = {
    primary:
      "bg-brand-600 text-white shadow-soft hover:bg-brand-700 hover:shadow-soft-lg",
    secondary:
      "border border-brand-200 bg-white/80 text-brand-800 backdrop-blur hover:border-brand-300 hover:bg-white",
    ghost: "text-slate-700 hover:bg-brand-50 hover:text-brand-800",
  };

  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}
