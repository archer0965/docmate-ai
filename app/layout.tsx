import type { Metadata } from "next";
import { Noto_Sans_TC, Sora } from "next/font/google";
import "./globals.css";

const notoSansTC = Noto_Sans_TC({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const siteTitle = "Nova AI Doc｜您的智慧文件助理，極速提煉長文本精華";
const siteDescription =
  "上傳 PDF／文件即可秒級生成重點摘要、深度問答與智慧考題筆記，大幅提升閱讀與工作效率。拓新雲端 NovaOS 子品牌。";

export const metadata: Metadata = {
  metadataBase: new URL("https://docmate-ai-one.vercel.app"),
  title: {
    default: siteTitle,
    template: "%s｜Nova AI Doc",
  },
  description: siteDescription,
  applicationName: "Nova AI Doc",
  openGraph: {
    type: "website",
    locale: "zh_TW",
    url: "https://docmate-ai-one.vercel.app",
    siteName: "Nova AI Doc",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/og-image.jpg?v=20261122-og",
        width: 2848,
        height: 1504,
        alt: "Nova AI Doc｜您的智慧文件助理，極速提煉長文本精華",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/og-image.jpg?v=20261122-og"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant-TW">
      <body className={`${notoSansTC.variable} ${sora.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
