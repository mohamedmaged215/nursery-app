"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import Navbar from "../components/Navbar";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  name: string;
  amount: number;
  date: string;
  type: "salary" | "supplies" | "rent";
  month: number; // 0-indexed
  year: number;
  createdAt: string;
}

interface Student {
  id: string;
  type: "street" | "bus";
  area: string;
  busAmount: number;
  status: "active" | "inactive";
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const BUS_AREAS = ["عربية عم سعيد", "عربية أبو الشيخ", "توكتوك العرب"] as const;

const TYPE_LABELS: Record<string, string> = {
  salary:   "مرتبات",
  supplies: "هوالك",
  rent:     "إيجار",
};

const TYPE_BADGE: Record<string, string> = {
  salary:   "bg-purple-100 text-purple-700",
  supplies: "bg-gray-100   text-gray-600",
  rent:     "bg-orange-100 text-orange-700",
};

// ─── Firestore helpers ────────────────────────────────────────────────────────

async function fetchExpenses(): Promise<Expense[]> {
  const snap = await getDocs(collection(db, "expenses"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));
}

async function fetchStudents(): Promise<Student[]> {
  const snap = await getDocs(collection(db, "students"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student));
}

async function createExpense(data: Omit<Expense, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "expenses"), data);
  return ref.id;
}

async function updateExpense(id: string, data: Partial<Omit<Expense, "id">>): Promise<void> {
  await updateDoc(doc(db, "expenses", id), data);
}

async function hardDeleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, "expenses", id));
}

function dateToMonthYear(dateStr: string): { month: number; year: number } {
  const d = new Date(dateStr);
  return { month: d.getMonth(), year: d.getFullYear() };
}

// ─── Add / Edit Expense Modal ─────────────────────────────────────────────────

function AddEditExpenseModal({
  expense,
  onClose,
  onSave,
}: {
  expense?: Expense;
  onClose: () => void;
  onSave: (expense: Expense) => void;
}) {
  const isEdit = !!expense;
  const todayStr = new Date().toISOString().slice(0, 10);

  const [name,   setName]   = useState(expense?.name ?? "");
  const [amount, setAmount] = useState(expense?.amount ? String(expense.amount) : "");
  const [date,   setDate]   = useState(expense?.date ?? todayStr);
  const [type,   setType]   = useState<Expense["type"]>(
    (expense?.type && expense.type in TYPE_LABELS) ? expense.type as Expense["type"] : "supplies"
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const amt = Number(amount);
    if (!name.trim())          { setError("يرجى إدخال البيان"); return; }
    if (isNaN(amt) || amt <= 0){ setError("يرجى إدخال مبلغ صحيح"); return; }
    if (!date)                  { setError("يرجى تحديد التاريخ"); return; }

    setSaving(true);
    try {
      const { month, year } = dateToMonthYear(date);
      const patch = { name: name.trim(), amount: amt, date, type, month, year };

      if (isEdit && expense) {
        await updateExpense(expense.id, patch);
        onSave({ ...expense, ...patch });
      } else {
        const full: Omit<Expense, "id"> = { ...patch, createdAt: new Date().toISOString().slice(0, 10) };
        const id = await createExpense(full);
        onSave({ id, ...full });
      }
      onClose();
    } catch {
      setError("حدث خطأ أثناء الحفظ. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 my-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? "تعديل المصروف" : "إضافة مصروف"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type toggle */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">النوع *</label>
            <div className="flex gap-2">
              {(["salary", "supplies", "rent"] as const).map((t) => (
                <button
                  key={t} type="button" onClick={() => setType(t)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition border ${
                    type === t
                      ? "bg-[#1976d2] text-white border-[#1976d2]"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">البيان *</label>
            <input
              type="text" required value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم المصروف"
              className={inputCls}
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">المبلغ (جنيه) *</label>
            <input
              type="number" min="1" required dir="ltr"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0" className={inputCls}
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">التاريخ *</label>
            <input
              type="date" required dir="ltr"
              value={date} onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
              إلغاء
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-[#1976d2] text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition">
              {saving ? "جارٍ الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

function DeleteConfirmModal({
  expense,
  loading,
  onConfirm,
  onClose,
}: {
  expense: Expense;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">تأكيد الحذف</h3>
        <p className="text-sm text-gray-500 mb-6">
          هل تريد حذف المصروف{" "}
          <span className="font-semibold text-gray-900">&quot;{expense.name}&quot;</span>؟
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
            إلغاء
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-60 transition">
            {loading ? "..." : "حذف"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked]     = useState(false);
  const [expenses, setExpenses]           = useState<Expense[]>([]);
  const [students, setStudents]           = useState<Student[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showAdd, setShowAdd]             = useState(false);
  const [editing, setEditing]             = useState<Expense | null>(null);
  const [deleting, setDeleting]           = useState<Expense | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [selMonth, setSelMonth] = useState(() => new Date().getMonth());
  const [selYear,  setSelYear]  = useState(() => new Date().getFullYear());

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) router.replace("/");
      else setAuthChecked(true);
    });
    return () => unsub();
  }, [router]);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authChecked) return;
    Promise.all([fetchExpenses(), fetchStudents()]).then(([e, s]) => {
      setExpenses(e);
      setStudents(s);
      setLoading(false);
    });
  }, [authChecked]);

  // ── Month options ──────────────────────────────────────────────────────────
  const monthOptions = useMemo(() => {
    const today = new Date();
    const seen = new Set<string>();
    seen.add(`${today.getFullYear()}-${today.getMonth()}`);
    for (const e of expenses) {
      if (e.year != null && e.month != null) seen.add(`${e.year}-${e.month}`);
    }
    return Array.from(seen)
      .map((key) => { const [y, m] = key.split("-").map(Number); return { year: y, month: m }; })
      .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
  }, [expenses]);

  // ── Filtered manual expenses for selected month ────────────────────────────
  const filtered = useMemo(
    () => expenses.filter((e) => e.month === selMonth && e.year === selYear),
    [expenses, selMonth, selYear]
  );

  const stats = useMemo(() => ({
    total: filtered.reduce((sum, e) => sum + e.amount, 0),
    count: filtered.length,
  }), [filtered]);

  // ── Bus expenses by area (live snapshot of active bus students) ────────────
  const busExpenses = useMemo(() => {
    return BUS_AREAS.map((area) => {
      const areaStudents = students.filter(
        (s) => s.status === "active" && s.type === "bus" && s.area === area
      );
      return {
        area,
        count: areaStudents.length,
        total: areaStudents.reduce((sum, s) => sum + (s.busAmount || 0), 0),
      };
    });
  }, [students]);

  const busTotalExpense = busExpenses.reduce((sum, b) => sum + b.total, 0);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleExpenseSaved(expense: Expense) {
    setExpenses((prev) => {
      const idx = prev.findIndex((e) => e.id === expense.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = expense;
        return next;
      }
      return [expense, ...prev];
    });
  }

  async function handleDelete(expense: Expense) {
    setActionLoading(expense.id);
    try {
      await hardDeleteExpense(expense.id);
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
    } finally {
      setActionLoading(null);
      setDeleting(null);
    }
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">المصاريف</h2>
            <p className="text-sm text-gray-500 mt-0.5">تتبع وإدارة مصاريف الحضانة</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1976d2] text-white text-sm font-bold hover:bg-blue-700 transition w-fit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            إضافة مصروف
          </button>
        </div>

        {/* ── Month selector + summary cards ──────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">ملخص الشهر</h3>
            <select
              value={`${selYear}-${selMonth}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-").map(Number);
                setSelYear(y);
                setSelMonth(m);
              }}
              className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            >
              {monthOptions.map(({ year, month }) => (
                <option key={`${year}-${month}`} value={`${year}-${month}`}>
                  {ARABIC_MONTHS[month]} {year}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-orange-50 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              <div className="bg-orange-100 text-orange-600 rounded-xl p-2 sm:p-3 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="text-center sm:text-right">
                <p className="text-xs sm:text-sm text-gray-500 font-medium">عدد المصاريف</p>
                <p className="text-lg sm:text-2xl font-bold text-orange-700">{stats.count}</p>
              </div>
            </div>

            <div className="bg-red-50 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              <div className="bg-red-100 text-red-600 rounded-xl p-2 sm:p-3 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="text-center sm:text-right">
                <p className="text-xs sm:text-sm text-gray-500 font-medium">
                  إجمالي المصاريف · {ARABIC_MONTHS[selMonth]}
                </p>
                <p className="text-lg sm:text-2xl font-bold text-red-700">
                  {stats.total.toLocaleString()} جنيه
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Manual expenses table ────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-xl h-14 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-200">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-sm font-medium">
              لا توجد مصاريف في {ARABIC_MONTHS[selMonth]} {selYear}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-right">
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">البيان</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">النوع</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">المبلغ</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">التاريخ</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered
                    .slice()
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((expense) => (
                      <tr key={expense.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                          {expense.name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[expense.type] ?? "bg-gray-100 text-gray-600"}`}>
                            {TYPE_LABELS[expense.type] ?? "أخرى"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-red-700 whitespace-nowrap">
                          {expense.amount.toLocaleString()} جنيه
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap" dir="ltr">
                          {expense.date}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setEditing(expense)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition"
                            >
                              تعديل
                            </button>
                            <button
                              onClick={() => setDeleting(expense)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 transition"
                            >
                              حذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
              <span>{filtered.length} مصروف</span>
              <span className="font-semibold text-red-700">
                الإجمالي: {stats.total.toLocaleString()} جنيه
              </span>
            </div>
          </div>
        )}

        {/* ── Bus expenses — auto section ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-blue-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-blue-900">مصاريف العربيات (تلقائي)</h3>
              <p className="text-xs text-blue-600 mt-0.5">محسوب من مبالغ عربيات الطلاب النشطين حالياً</p>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">
              قراءة فقط
            </span>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-lg h-10 animate-pulse" />
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-right">
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs">المنطقة</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs">عدد الطلاب</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs">إجمالي العربيات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {busExpenses.map(({ area, count, total }) => (
                  <tr key={area} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-800 font-medium">{area}</td>
                    <td className="px-4 py-2.5 text-gray-600">{count} طالب</td>
                    <td className="px-4 py-2.5 font-semibold text-blue-700">
                      {total.toLocaleString()} جنيه
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-blue-50">
                  <td className="px-4 py-2.5 font-semibold text-gray-700 text-sm">
                    الإجمالي ({busExpenses.reduce((s, b) => s + b.count, 0)} طالب)
                  </td>
                  <td />
                  <td className="px-4 py-2.5 font-bold text-blue-700 text-sm">
                    {busTotalExpense.toLocaleString()} جنيه
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

      </main>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showAdd && (
        <AddEditExpenseModal
          onClose={() => setShowAdd(false)}
          onSave={(exp) => { handleExpenseSaved(exp); setShowAdd(false); }}
        />
      )}

      {editing && (
        <AddEditExpenseModal
          expense={editing}
          onClose={() => setEditing(null)}
          onSave={(exp) => { handleExpenseSaved(exp); setEditing(null); }}
        />
      )}

      {deleting && (
        <DeleteConfirmModal
          expense={deleting}
          loading={actionLoading === deleting.id}
          onConfirm={() => handleDelete(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
