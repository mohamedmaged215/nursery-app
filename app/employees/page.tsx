"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import Navbar from "../components/Navbar";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  name: string;
  role: "teacher" | "driver" | "other";
  area: string;
  monthlySalary: number;
  createdAt: string;
}

interface Salary {
  id: string;
  employeeId: string;
  amount: number;
  month: number; // 0-indexed (0 = January)
  year: number;
  date: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const AREAS = ["شرق الكوبري", "البلدة", "العرب"];

const ROLE_LABELS: Record<Employee["role"], string> = {
  teacher: "معلمة",
  driver: "سايق",
  other: "أخرى",
};

const ROLE_BADGE: Record<Employee["role"], string> = {
  teacher: "bg-purple-100 text-purple-700",
  driver:  "bg-blue-100   text-blue-700",
  other:   "bg-gray-100   text-gray-600",
};

// ─── Firestore helpers ────────────────────────────────────────────────────────

async function fetchEmployees(): Promise<Employee[]> {
  const snap = await getDocs(collection(db, "employees"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Employee));
}

async function createEmployee(data: Omit<Employee, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "employees"), data);
  return ref.id;
}

async function updateEmployee(id: string, data: Partial<Omit<Employee, "id">>): Promise<void> {
  await updateDoc(doc(db, "employees", id), data);
}

async function hardDeleteEmployee(id: string): Promise<void> {
  await deleteDoc(doc(db, "employees", id));
}

async function fetchSalaries(): Promise<Salary[]> {
  const snap = await getDocs(collection(db, "salaries"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Salary));
}

async function createSalary(data: Omit<Salary, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "salaries"), data);
  return ref.id;
}

// ─── Add / Edit Employee Modal ────────────────────────────────────────────────

function AddEditEmployeeModal({
  employee,
  onClose,
  onSave,
}: {
  employee?: Employee;
  onClose: () => void;
  onSave: (employee: Employee) => void;
}) {
  const isEdit = !!employee;
  const [name, setName] = useState(employee?.name ?? "");
  const [role, setRole] = useState<Employee["role"]>(employee?.role ?? "teacher");
  const [area, setArea] = useState(employee?.area || AREAS[0]);
  const [monthlySalary, setMonthlySalary] = useState(
    employee?.monthlySalary ? String(employee.monthlySalary) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const salary = Number(monthlySalary);
    if (!name.trim()) { setError("يرجى إدخال اسم الموظف"); return; }
    if (isNaN(salary) || salary <= 0) { setError("يرجى إدخال مرتب شهري صحيح"); return; }
    setSaving(true);
    try {
      const patch = {
        name: name.trim(),
        role,
        area: role === "driver" ? area : "",
        monthlySalary: salary,
      };
      if (isEdit && employee) {
        await updateEmployee(employee.id, patch);
        onSave({ ...employee, ...patch });
      } else {
        const full: Omit<Employee, "id"> = { ...patch, createdAt: new Date().toISOString().slice(0, 10) };
        const id = await createEmployee(full);
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
            {isEdit ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">اسم الموظف *</label>
            <input
              type="text" required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="أدخل اسم الموظف" className={inputCls}
            />
          </div>

          {/* Role toggle */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">الوظيفة *</label>
            <div className="flex gap-2">
              {(["teacher", "driver", "other"] as const).map((r) => (
                <button
                  key={r} type="button" onClick={() => setRole(r)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition border ${
                    role === r
                      ? "bg-[#1976d2] text-white border-[#1976d2]"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          {/* Area — only for drivers */}
          {role === "driver" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">المنطقة *</label>
              <select value={area} onChange={(e) => setArea(e.target.value)} className={inputCls}>
                {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}

          {/* Monthly salary */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">المرتب الشهري (جنيه) *</label>
            <input
              type="number" min="1" required dir="ltr"
              value={monthlySalary} onChange={(e) => setMonthlySalary(e.target.value)}
              placeholder="0" className={inputCls}
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

// ─── Salary Modal ─────────────────────────────────────────────────────────────

function SalaryModal({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee;
  onClose: () => void;
  onSaved: (salary: Salary) => void;
}) {
  const today = new Date();
  const [selMonth, setSelMonth] = useState(today.getMonth());
  const [selYear, setSelYear]   = useState(today.getFullYear());
  const [amount, setAmount]     = useState(String(employee.monthlySalary));
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  const years = [today.getFullYear(), today.getFullYear() - 1];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) { setError("يرجى إدخال مبلغ صحيح"); return; }
    setSaving(true);
    try {
      const data: Omit<Salary, "id"> = {
        employeeId: employee.id,
        amount: amt,
        month: selMonth,
        year: selYear,
        date: today.toISOString().slice(0, 10),
      };
      const id = await createSalary(data);
      onSaved({ id, ...data });
      onClose();
    } catch {
      setError("حدث خطأ أثناء الحفظ. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "px-3 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">تسجيل مرتب</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Employee info card */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 mb-5">
          <p className="text-sm font-semibold text-gray-900">{employee.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {ROLE_LABELS[employee.role]}
            {employee.role === "driver" && employee.area ? ` · ${employee.area}` : ""}
            {" · "}المرتب الأساسي: {employee.monthlySalary.toLocaleString()} جنيه
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Month / Year selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">الشهر</label>
            <div className="flex gap-2">
              <select
                value={selMonth} onChange={(e) => setSelMonth(Number(e.target.value))}
                className={`flex-1 ${inputCls}`}
              >
                {ARABIC_MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select
                value={selYear} onChange={(e) => setSelYear(Number(e.target.value))}
                className={`w-24 ${inputCls}`}
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">المبلغ (جنيه)</label>
            <input
              type="number" min="1" required dir="ltr" autoFocus
              value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={`w-full ${inputCls}`}
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
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

function DeleteConfirmModal({
  employee,
  loading,
  onConfirm,
  onClose,
}: {
  employee: Employee;
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
          هل تريد حذف الموظف{" "}
          <span className="font-semibold text-gray-900">{employee.name}</span>؟
          <br />
          لا يمكن التراجع عن هذا الإجراء.
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

export default function EmployeesPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked]     = useState(false);
  const [employees, setEmployees]         = useState<Employee[]>([]);
  const [salaries, setSalaries]           = useState<Salary[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showAdd, setShowAdd]             = useState(false);
  const [editing, setEditing]             = useState<Employee | null>(null);
  const [salaryFor, setSalaryFor]         = useState<Employee | null>(null);
  const [deleting, setDeleting]           = useState<Employee | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Month selector for summary (initialised from current date inside useMemo below)
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
    Promise.all([fetchEmployees(), fetchSalaries()]).then(([e, s]) => {
      setEmployees(e);
      setSalaries(s);
      setLoading(false);
    });
  }, [authChecked]);

  // ── Month options (last 13 months) ─────────────────────────────────────────
  const monthOptions = useMemo(() => {
    const today = new Date();
    const opts: { month: number; year: number }[] = [];
    const d = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    for (let i = 0; i < 14; i++) {
      d.setMonth(d.getMonth() - 1);
      opts.push({ month: d.getMonth(), year: d.getFullYear() });
    }
    return opts;
  }, []);

  // ── Summary stats for selected month ──────────────────────────────────────
  const stats = useMemo(() => {
    const monthSalaries = salaries.filter(
      (s) => s.month === selMonth && s.year === selYear
    );
    return {
      totalSalaries: monthSalaries.reduce((sum, s) => sum + s.amount, 0),
      employeeCount: employees.length,
    };
  }, [salaries, employees, selMonth, selYear]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleEmployeeSaved(emp: Employee) {
    setEmployees((prev) => {
      const idx = prev.findIndex((e) => e.id === emp.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = emp;
        return next;
      }
      return [emp, ...prev];
    });
  }

  function handleSalarySaved(salary: Salary) {
    setSalaries((prev) => [salary, ...prev]);
  }

  async function handleDelete(emp: Employee) {
    setActionLoading(emp.id);
    try {
      await hardDeleteEmployee(emp.id);
      setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
    } finally {
      setActionLoading(null);
      setDeleting(null);
    }
  }

  // ── Loading / auth spinner ─────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">الموظفين</h2>
            <p className="text-sm text-gray-500 mt-0.5">إدارة الموظفين والمرتبات</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1976d2] text-white text-sm font-bold hover:bg-blue-700 transition w-fit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            إضافة موظف
          </button>
        </div>

        {/* ── Summary cards ───────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">ملخص المرتبات</h3>
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
            {/* Total employees */}
            <div className="bg-blue-50 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              <div className="bg-blue-100 text-blue-600 rounded-xl p-2 sm:p-3 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="text-center sm:text-right">
                <p className="text-xs sm:text-sm text-gray-500 font-medium">عدد الموظفين</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-700">{stats.employeeCount}</p>
              </div>
            </div>

            {/* Total salaries for selected month */}
            <div className="bg-red-50 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              <div className="bg-red-100 text-red-600 rounded-xl p-2 sm:p-3 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-center sm:text-right">
                <p className="text-xs sm:text-sm text-gray-500 font-medium">
                  إجمالي المرتبات · {ARABIC_MONTHS[selMonth]}
                </p>
                <p className="text-lg sm:text-2xl font-bold text-red-700">
                  {stats.totalSalaries.toLocaleString()} جنيه
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Employee table ───────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-xl h-14 animate-pulse" />
            ))}
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <svg className="w-14 h-14 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm font-medium">لا يوجد موظفين. أضف أول موظف!</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-right">
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">الاسم</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">الوظيفة</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">المنطقة</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">المرتب الشهري</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {emp.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[emp.role]}`}>
                          {ROLE_LABELS[emp.role]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {emp.role === "driver" && emp.area ? emp.area : "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {emp.monthlySalary.toLocaleString()} جنيه
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSalaryFor(emp)}
                            className="px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition"
                          >
                            تسجيل مرتب
                          </button>
                          <button
                            onClick={() => setEditing(emp)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition"
                          >
                            تعديل
                          </button>
                          <button
                            onClick={() => setDeleting(emp)}
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
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
              {employees.length} موظف
            </div>
          </div>
        )}
      </main>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showAdd && (
        <AddEditEmployeeModal
          onClose={() => setShowAdd(false)}
          onSave={(emp) => { handleEmployeeSaved(emp); setShowAdd(false); }}
        />
      )}

      {editing && (
        <AddEditEmployeeModal
          employee={editing}
          onClose={() => setEditing(null)}
          onSave={(emp) => { handleEmployeeSaved(emp); setEditing(null); }}
        />
      )}

      {salaryFor && (
        <SalaryModal
          employee={salaryFor}
          onClose={() => setSalaryFor(null)}
          onSaved={handleSalarySaved}
        />
      )}

      {deleting && (
        <DeleteConfirmModal
          employee={deleting}
          loading={actionLoading === deleting.id}
          onConfirm={() => handleDelete(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
