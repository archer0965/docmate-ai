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

const siteTitle = "Nova AI Doc｜AI 文件智慧助理";
const siteDescription =
  "Nova AI Doc 幫你上傳 PDF、產生摘要、文件問答與知識整理。拓新雲端 NovaOS 子品牌。";

export const metadata: Metadata = {
  metadataBase: new URL("https://docmate-ai-one.vercel.app"),
  title: siteTitle,
  description: siteDescription,
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
        alt: "Nova AI Doc｜智慧文件助理",
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
