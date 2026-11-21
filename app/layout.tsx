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
  title: "DocMate AI｜AI 文件智慧助理",
  description:
    "DocMate AI 幫你上傳 PDF、產生摘要、文件問答、考題與筆記整理。適合學生與知識工作者。",
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
