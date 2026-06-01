import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Game Weaver",
  description: "从一句话创意自动生成可预览网页游戏",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
