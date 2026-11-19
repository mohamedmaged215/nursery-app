"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center max-w-sm w-full">
        <h2 className="text-lg font-bold text-gray-900 mb-2">حصل خطأ غير متوقع</h2>
        <p className="text-sm text-gray-500 mb-6">جرّب تاني، ولو المشكلة فضلت اعمل تحديث للصفحة.</p>
        <button
          onClick={() => unstable_retry()}
          className="w-full py-2.5 rounded-lg bg-[#1976d2] text-white text-sm font-bold hover:bg-blue-700 transition"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
