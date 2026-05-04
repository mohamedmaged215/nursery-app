"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../../components/Navbar";
import { getCustomers, updateCustomer } from "../../../lib/firebaseUtils";
import { calculateEndDate, calculateStatus } from "../../../lib/customerUtils";
import { Customer } from "../../../lib/types";

export default function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    subscriptionType: "monthly" as "monthly" | "session",
    startDate: "",
    durationDays: "",
    price: "",
  });

  useEffect(() => {
    getCustomers().then((customers) => {
      const c = customers.find((x: Customer) => x.id === id);
      if (c) {
        setForm({
          name: c.name,
          phone: c.phone,
          subscriptionType: c.subscriptionType ?? "monthly",
          startDate: c.startDate,
          durationDays: String(c.durationDays),
          price: String(c.price),
        });
      }
      setLoading(false);
    });
  }, [id]);

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
      await updateCustomer(id, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        subscriptionType: "session",
        price: Number(form.price),
        status: "session",
      });
    } else {
      if (!endDate) { setSaving(false); return; }
      const status = calculateStatus(endDate);
      await updateCustomer(id, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        subscriptionType: "monthly",
        startDate: form.startDate,
        endDate,
        durationDays: Number(form.durationDays),
        price: Number(form.price),
        status,
      });
    }

    router.push("/customers");
  }

  if (loading) {
    return (
      <div className="min-h-full">
        <Navbar />
        <main className="max-w-lg mx-auto px-4 sm:px-6 py-8">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    );
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
          <h2 className="text-xl font-bold text-gray-900">تعديل بيانات العميل</h2>
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
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {saving ? "جارٍ الحفظ…" : "حفظ التغييرات"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
