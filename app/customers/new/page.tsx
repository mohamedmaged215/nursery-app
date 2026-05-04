"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import { addCustomer, addPayment } from "../../lib/firebaseUtils";
import { calculateEndDate, calculateStatus } from "../../lib/customerUtils";

export default function NewCustomerPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    subscriptionType: "monthly" as "monthly" | "session",
    startDate: "",
    durationDays: "",
    price: "",
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const isSession = form.subscriptionType === "session";
  const endDate =
    !isSession && form.startDate && form.durationDays
      ? calculateEndDate(form.startDate, Number(form.durationDays))
      : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    if (isSession) {
      const today = new Date().toISOString().split("T")[0];
      const customerId = await addCustomer({
        name: form.name.trim(),
        phone: form.phone.trim(),
        subscriptionType: "session",
        startDate: today,
        endDate: today,
        durationDays: 0,
        price: Number(form.price),
        status: "session",
      });
      await addPayment({ customerId, amount: Number(form.price), date: today });
    } else {
      if (!endDate) { setSaving(false); return; }
      const status = calculateStatus(endDate);
      const customerId = await addCustomer({
        name: form.name.trim(),
        phone: form.phone.trim(),
        subscriptionType: "monthly",
        startDate: form.startDate,
        endDate,
        durationDays: Number(form.durationDays),
        price: Number(form.price),
        status,
      });
      await addPayment({ customerId, amount: Number(form.price), date: form.startDate });
    }

    router.push("/customers");
  }

  return (
    <div className="min-h-full">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            رجوع
          </button>
          <h2 className="text-xl font-bold text-gray-900">إضافة عميل جديد</h2>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع الاشتراك</label>
              <div className="flex gap-3">
                {(["monthly", "session"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => set("subscriptionType", type)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition ${
                      form.subscriptionType === type
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {type === "monthly" ? "شهري" : "حصة"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الاسم</label>
              <input
                required
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Ahmed Mohamed"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الهاتف</label>
              <input
                required
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="01012345678"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {!isSession && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ البداية</label>
                  <input
                    required
                    type="date"
                    value={form.startDate}
                    onChange={(e) => set("startDate", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">المدة (أيام)</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={form.durationDays}
                    onChange={(e) => set("durationDays", e.target.value)}
                    placeholder="30"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>

                {endDate && (
                  <div className="flex items-center gap-2 px-3.5 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    تاريخ الانتهاء: <strong>{endDate}</strong>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {isSession ? "سعر الحصة (جنيه)" : "السعر (جنيه)"}
              </label>
              <input
                required
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="500"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {saving ? "جارٍ الحفظ…" : "إضافة عميل"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
