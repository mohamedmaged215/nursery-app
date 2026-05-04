import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({ subsets: ["arabic", "latin"] });

export const metadata: Metadata = {
  title: "حضانة شرق الكوبري",
  description: "نظام إدارة حضانة شرق الكوبري",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="min-h-screen">
      <body className={`${cairo.className} min-h-screen bg-[#f5f5f5] text-gray-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}
