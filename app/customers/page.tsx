"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getCustomers, deleteCustomer, renewCustomer } from "../lib/firebaseUtils";
import { calculateEndDate, calculateStatus } from "../lib/customerUtils";
import { Customer } from "../lib/types";
import Navbar from "../components/Navbar";

const STATUS_STYLES: Record<string, string> = {
  active:   "bg-green-100 text-green-700",
  expiring: "bg-orange-100 text-orange-700",
  expired:  "bg-red-100 text-red-700",
  session:  "bg-blue-100 text-blue-700",
};

function statusLabel(c: Customer): string {
  if ((c.subscriptionType ?? "monthly") === "session") return "حصة";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = new Date(c.endDate); end.setHours(0, 0, 0, 0);
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0)   return "منتهي";
  if (diff === 0) return "ينتهي اليوم";
  if (diff === 1) return "باقي يوم واحد";
  if (diff === 2) return "باقي 2 يوم";
  if (diff === 3) return "باقي 3 أيام";
  return "نشط";
}

function DeleteModal({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-2">تأكيد الحذف</h3>
        <p className="text-sm text-gray-600 mb-6">
          هل أنت متأكد من حذف العميل <span className="font-semibold text-gray-900">{name}</span>؟
          <br />
          <span className="text-red-500">لا يمكن التراجع عن هذا الإجراء.</span>
        </p>
        <div className="flex gap-3">
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">حذف</button>
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition">إلغاء</button>
        </div>
      </div>
    </div>
  );
}

function RenewModal({
  customer,
  onConfirm,
  onCancel,
}: {
  customer: Customer;
  onConfirm: (startDate: string, durationDays: number, price: number) => Promise<void>;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    startDate: today,
    durationDays: "30",
    price: String(customer.price),
  });
  const [saving, setSaving] = useState(false);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const newEndDate =
    form.startDate && form.durationDays
      ? calculateEndDate(form.startDate, Number(form.durationDays))
      : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newEndDate) return;
    setSaving(true);
    await onConfirm(form.startDate, Number(form.durationDays), Number(form.price));
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-1">تجديد الاشتراك</h3>
        <p className="text-sm text-gray-500 mb-5">{customer.name}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ البداية</label>
            <input
              required
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">المدة الجديدة (أيام)</label>
            <input
              required
              type="number"
              min="1"
              value={form.durationDays}
              onChange={(e) => set("durationDays", e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            />
          </div>

          {newEndDate && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              تاريخ الانتهاء الجديد: <strong>{newEndDate}</strong>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">السعر (جنيه)</label>
            <input
              required
              type="number"
              min="0"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {saving ? "جارٍ التجديد…" : "تجديد الاشتراك"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CustomersContent() {
  const searchParams = useSearchParams();
  const urlFilter = searchParams.get("filter") ?? "";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [renewTarget, setRenewTarget] = useState<Customer | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const data = await getCustomers();
    data.sort((a, b) => a.name.localeCompare(b.name));
    setCustomers(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteCustomer(deleteTarget.id);
    setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  async function confirmRenew(startDate: string, durationDays: number, price: number) {
    if (!renewTarget) return;
    const endDate = calculateEndDate(startDate, durationDays);
    const status = calculateStatus(endDate);
    await renewCustomer(
      renewTarget.id,
      { startDate, endDate, durationDays, price, status },
      { customerId: renewTarget.id, amount: price, date: startDate }
    );
    const name = renewTarget.name;
    setRenewTarget(null);
    await load();
    setSuccessMsg(`تم تجديد اشتراك ${name} بنجاح ✅`);
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  const afterUrlFilter = customers.filter((c) => {
    if (urlFilter === "active")   return c.status === "active" || c.status === "expiring";
    if (urlFilter === "expiring") return c.status === "expiring";
    if (urlFilter === "expired")  return c.status === "expired";
    if (urlFilter === "new")      return c.startDate >= monthStart;
    return true;
  });

  const filtered = afterUrlFilter.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  function waMessageExpiring(name: string, endDate: string) {
    return `السلام عليكم يا ${name} 👋\nبنفكرك إن اشتراكك في الجيم هينتهي يوم ${endDate} 💪\nمتنساش تجدد اشتراكك قريب عشان تكون دايما من أبطال Hulk Gym 🏋️\nمع تحيات إدارة الجيم`;
  }

  function waMessageExpired(name: string, endDate: string) {
    return `السلام عليكم يا ${name} 👋\nاشتراكك في الجيم انتهي من يوم ${endDate} 😔\nمتأخرتش! جدد اشتراكك دلوقتي وارجع تتمرن مع أبطال Hulk Gym 💪🏋️\nمع تحيات إدارة الجيم`;
  }

  function waMessageSession(name: string) {
    return `السلام عليكم يا ${name} 👋\nإزيك؟ مشتاقين ليك في Hulk Gym 🏋️\nمتنساش حصصك! نورنا دلوقتي 💪\nمع تحيات إدارة الجيم`;
  }

  const FILTER_LABELS: Record<string, string> = {
    active:   "الأعضاء النشطون",
    expiring: "تنتهي قريباً",
    expired:  "اشتراكات منتهية",
    new:      "عملاء جدد هذا الشهر",
  };

  return (
    <div className="min-h-full">
      <Navbar />

      {deleteTarget && (
        <DeleteModal
          name={deleteTarget.name}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {renewTarget && (
        <RenewModal
          customer={renewTarget}
          onConfirm={confirmRenew}
          onCancel={() => setRenewTarget(null)}
        />
      )}

      {successMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-green-600 text-white text-sm font-semibold rounded-xl shadow-lg">
          {successMsg}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900">العملاء</h2>
            {urlFilter && FILTER_LABELS[urlFilter] && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                {FILTER_LABELS[urlFilter]}
                <Link href="/customers" className="hover:text-blue-900">✕</Link>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/customers/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              إضافة عميل جديد
            </Link>
          </div>
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder="بحث بالاسم أو الهاتف…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-72 px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="divide-y divide-gray-100">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-50 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-16">لا يوجد عملاء.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">الاسم</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">الهاتف</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">البداية</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">النهاية</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">السعر</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">الحالة</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((c) => {
                    const isSession = (c.subscriptionType ?? "monthly") === "session";
                    const waMsg = isSession
                      ? waMessageSession(c.name)
                      : c.status === "expired"
                        ? waMessageExpired(c.name, c.endDate)
                        : waMessageExpiring(c.name, c.endDate);
                    const waLink = `https://wa.me/2${c.phone}?text=${encodeURIComponent(waMsg)}`;
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                        <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                        <td className="px-4 py-3 text-gray-600">{isSession ? "—" : c.startDate}</td>
                        <td className="px-4 py-3 text-gray-600">{isSession ? "—" : c.endDate}</td>
                        <td className="px-4 py-3 text-gray-600">{c.price.toLocaleString()} جنيه</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[c.status]}`}>
                            {statusLabel(c)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-start gap-2">
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="إرسال تذكير واتساب"
                              className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                              </svg>
                            </a>
                            {!isSession && <button
                              onClick={() => setRenewTarget(c)}
                              className="p-1.5 rounded-lg text-green-700 hover:bg-green-50 transition"
                              title="تجديد الاشتراك"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>}
                            <Link
                              href={`/customers/${c.id}/edit`}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition"
                              title="تعديل"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </Link>
                            <button
                              onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition"
                              title="حذف"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense>
      <CustomersContent />
    </Suspense>
  );
}
