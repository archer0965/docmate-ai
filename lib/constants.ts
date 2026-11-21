/**
 * 網站共用常數
 * 初學者提示：之後若要改品牌名稱、導覽連結，優先改這裡。
 */

/** Canonical product name (NovaOS sub-brand). */
export const SITE_NAME = "Nova AI Doc";

/** Production URL on Vercel. */
export const SITE_URL = "https://docmate-ai-one.vercel.app";

export const SITE_TAGLINE =
  "您的智慧文件助理，極速提煉長文本精華——摘要、深度問答與智慧考題筆記";

export const NAV_LINKS = [
  { href: "#features", label: "功能" },
  { href: "#how-it-works", label: "使用方式" },
  { href: "#pricing", label: "方案" },
] as const;
