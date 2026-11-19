"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStatus } from "../lib/auth";
import { DataProvider, useData } from "../lib/store";
import Navbar from "../components/Navbar";
import { Spinner } from "../components/ui";

// الـ layout ده مشترك بين كل صفحات النظام: فحص الدخول والـ Navbar والبيانات
// بيتحملوا مرة واحدة وبيفضلوا ثابتين مع التنقل بين الصفحات.

function LoadErrorBanner() {
  const { error, refresh, refreshing } = useData();
  if (!error) return null;
  return (
    <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex flex-wrap items-center justify-center gap-3 text-sm text-red-700">
      <span>تعذّر تحميل البيانات. تأكد من اتصال الإنترنت.</span>
      <button
        onClick={refresh}
        disabled={refreshing}
        className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-60 transition"
      >
        {refreshing ? "جارٍ المحاولة..." : "إعادة المحاولة"}
      </button>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const status = useAuthStatus();

  useEffect(() => {
    if (status === "out") router.replace("/");
  }, [status, router]);

  if (status !== "in") return <Spinner />;

  return (
    <DataProvider>
      <div className="min-h-screen">
        <Navbar />
        <LoadErrorBanner />
        {children}
      </div>
    </DataProvider>
  );
}
