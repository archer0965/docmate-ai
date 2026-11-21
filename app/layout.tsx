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

export const metadata: Metadata = {
  metadataBase: new URL("https://docmate-ai-one.vercel.app"),
  title: "Nova AI Doc｜AI 文件智慧助理",
  description:
    "Nova AI Doc 幫你上傳 PDF、產生摘要、文件問答與知識整理。拓新雲端 NovaOS 子品牌。",
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
