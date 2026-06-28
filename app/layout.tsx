import type { Metadata } from "next";
import "./globals.css";
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: "暖暖 - 你的健康记录小助手",
  description: "专为肠胃敏感、容易焦虑的女生设计的温柔健康记录工具",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gradient-to-br from-warm-white via-[#fef0f0] to-[#f5f0ff]">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
