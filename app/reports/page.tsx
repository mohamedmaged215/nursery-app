"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import { auth, db } from "../lib/firebase";
import Navbar from "../components/Navbar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  name: string;
  phone: string;
  type: "street" | "bus";
  area: string;
  subscriptionAmount: number;
  busAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: "active" | "inactive";
}

interface Payment {
  id: string;
  studentId: string;
  amount: number;
  date: string;
}

interface Expense {
  id: string;
  name: string;
  amount: number;
  type: "rent" | "bus" | "other";
  month: number;
  year: number;
  date: string;
}

interface Salary {
  id: string;
  employeeId: string;
  amount: number;
  month: number;
  year: number;
}

interface Employee {
  id: string;
  name: string;
  role: "teacher" | "driver" | "other";
  area: string;
  monthlySalary: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const EXPENSE_TYPE_LABELS: Record<Expense["type"], string> = {
  rent: "إيجار", bus: "عربيات", other: "أخرى",
};

const ROLE_LABELS: Record<Employee["role"], string> = {
  teacher: "معلمة", driver: "سايق", other: "أخرى",
};

// ─── Firestore fetchers ───────────────────────────────────────────────────────

async function fetchCollection<T>(name: string): Promise<T[]> {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

// ─── Revenue helpers ──────────────────────────────────────────────────────────

function splitRevenue(
  pmts: Payment[],
  map: Record<string, Student>
): { subscription: number; bus: number } {
  let subscription = 0;
  let bus = 0;
  for (const p of pmts) {
    const s = map[p.studentId];
    if (!s || s.totalAmount === 0 || s.type !== "bus") {
      subscription += p.amount;
    } else {
      const busRatio = s.busAmount / s.totalAmount;
      bus += p.amount * busRatio;
      subscription += p.amount * (1 - busRatio);
    }
  }
  return { subscription, bus };
}

function monthPrefix(month: number, year: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, color,
}: {
  label: string;
  value: string;
  color: "green" | "blue" | "red" | "orange" | "purple";
}) {
  const cls = {
    green:  { bg: "bg-green-50",  icon: "bg-green-100  text-green-600",  text: "text-green-700"  },
    blue:   { bg: "bg-blue-50",   icon: "bg-blue-100   text-blue-600",   text: "text-blue-700"   },
    red:    { bg: "bg-red-50",    icon: "bg-red-100    text-red-600",    text: "text-red-700"    },
    orange: { bg: "bg-orange-50", icon: "bg-orange-100 text-orange-600", text: "text-orange-700" },
    purple: { bg: "bg-purple-50", icon: "bg-purple-100 text-purple-600", text: "text-purple-700" },
  }[color];
  return (
    <div className={`${cls.bg} rounded-2xl p-4 sm:p-5`}>
      <p className={`text-xs sm:text-sm font-medium text-gray-500 mb-1 leading-snug`}>{label}</p>
      <p className={`text-lg sm:text-xl font-bold ${cls.text}`}>{value}</p>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [students,  setStudents]  = useState<Student[]>([]);
  const [payments,  setPayments]  = useState<Payment[]>([]);
  const [expenses,  setExpenses]  = useState<Expense[]>([]);
  const [salaries,  setSalaries]  = useState<Salary[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [selMonth, setSelMonth] = useState(() => new Date().getMonth());
  const [selYear,  setSelYear]  = useState(() => new Date().getFullYear());

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) router.replace("/");
      else setAuthChecked(true);
    });
    return () => unsub();
  }, [router]);

  // ── Load all collections ───────────────────────────────────────────────────
  useEffect(() => {
    if (!authChecked) return;
    Promise.all([
      fetchCollection<Student>("students"),
      fetchCollection<Payment>("payments"),
      fetchCollection<Expense>("expenses"),
      fetchCollection<Salary>("salaries"),
      fetchCollection<Employee>("employees"),
    ]).then(([s, p, e, sal, emp]) => {
      setStudents(s);
      setPayments(p);
      setExpenses(e);
      setSalaries(sal);
      setEmployees(emp);
      setLoading(false);
    });
  }, [authChecked]);

  // ── Derived maps ───────────────────────────────────────────────────────────
  const studentsMap = useMemo(() => {
    const m: Record<string, Student> = {};
    for (const s of students) m[s.id] = s;
    return m;
  }, [students]);

  const employeesMap = useMemo(() => {
    const m: Record<string, Employee> = {};
    for (const e of employees) m[e.id] = e;
    return m;
  }, [employees]);

  // ── Month options (union of all data months + current) ─────────────────────
  const monthOptions = useMemo(() => {
    const today = new Date();
    const seen = new Set<string>();
    seen.add(`${today.getFullYear()}-${today.getMonth()}`);
    for (const e of expenses) {
      if (e.year != null && e.month != null) seen.add(`${e.year}-${e.month}`);
    }
    for (const s of salaries) {
      if (s.year != null && s.month != null) seen.add(`${s.year}-${s.month}`);
    }
    for (const p of payments) {
      if (p.date) {
        const d = new Date(p.date);
        if (!isNaN(d.getTime())) seen.add(`${d.getFullYear()}-${d.getMonth()}`);
      }
    }
    return Array.from(seen)
      .map((k) => { const [y, m] = k.split("-").map(Number); return { year: y, month: m }; })
      .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
  }, [expenses, salaries, payments]);

  // ── Per-month stats for selected month ────────────────────────────────────
  const monthStats = useMemo(() => {
    const prefix = monthPrefix(selMonth, selYear);
    const mPayments = payments.filter((p) => p.date?.startsWith(prefix));
    const { subscription, bus } = splitRevenue(mPayments, studentsMap);

    const mExpenses = expenses.filter((e) => e.month === selMonth && e.year === selYear);
    const totalExpenses = mExpenses.reduce((s, e) => s + e.amount, 0);

    const mSalaries = salaries.filter((s) => s.month === selMonth && s.year === selYear);
    const totalSalaries = mSalaries.reduce((s, sal) => s + sal.amount, 0);

    const netProfit = subscription + bus - totalExpenses - totalSalaries;

    // Bus revenue by area
    const busByArea: Record<string, number> = {};
    for (const p of mPayments) {
      const st = studentsMap[p.studentId];
      if (st?.type === "bus" && st.totalAmount > 0) {
        const area = st.area || "غير محدد";
        const busRatio = st.busAmount / st.totalAmount;
        busByArea[area] = (busByArea[area] ?? 0) + p.amount * busRatio;
      }
    }

    // Expenses by type
    const expByType: Record<string, number> = { rent: 0, bus: 0, other: 0 };
    for (const e of mExpenses) {
      expByType[e.type] = (expByType[e.type] ?? 0) + e.amount;
    }

    // Salary rows
    const salaryRows = mSalaries
      .map((s) => ({ ...s, employee: employeesMap[s.employeeId] }))
      .filter((s) => s.employee)
      .sort((a, b) => b.amount - a.amount);

    return {
      subscription, bus, totalExpenses, totalSalaries, netProfit,
      busByArea, expByType, salaryRows, mExpenses,
    };
  }, [selMonth, selYear, payments, expenses, salaries, studentsMap, employeesMap]);

  // ── Chart data — last 6 months ending at selected month ───────────────────
  const chartData = useMemo(() => {
    const months: { month: number; year: number }[] = [];
    let y = selYear, m = selMonth;
    for (let i = 0; i < 6; i++) {
      months.unshift({ month: m, year: y });
      m--; if (m < 0) { m = 11; y--; }
    }

    return months.map(({ month, year }) => {
      const prefix = monthPrefix(month, year);
      const mPmts = payments.filter((p) => p.date?.startsWith(prefix));
      const { subscription, bus } = splitRevenue(mPmts, studentsMap);
      const mExp = expenses.filter((e) => e.month === month && e.year === year);
      const mSal = salaries.filter((s) => s.month === month && s.year === year);
      const totalExp = mExp.reduce((s, e) => s + e.amount, 0);
      const totalSal = mSal.reduce((s, sal) => s + sal.amount, 0);
      const revenues = subscription + bus;
      const costs = totalExp + totalSal;
      const profit = revenues - costs;
      return {
        name: ARABIC_MONTHS[month].slice(0, 3),
        revenues,
        costs,
        profit,
        isCurrent: month === selMonth && year === selYear,
      };
    });
  }, [selMonth, selYear, payments, expenses, salaries, studentsMap]);

  // ── Students with remaining balance ───────────────────────────────────────
  const studentsWithBalance = useMemo(
    () => students
      .filter((s) => s.status === "active" && s.remainingAmount > 0)
      .sort((a, b) => b.remainingAmount - a.remainingAmount),
    [students]
  );

  if (!authChecked) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const { subscription, bus, totalExpenses, totalSalaries, netProfit,
          busByArea, expByType, salaryRows } = monthStats;

  return (
    <div className="min-h-full">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Header + month selector ─────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">التقارير</h2>
            <p className="text-sm text-gray-500 mt-0.5">تقرير مالي شهري تفصيلي</p>
          </div>
          <select
            value={`${selYear}-${selMonth}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split("-").map(Number);
              setSelYear(y); setSelMonth(m);
            }}
            className="px-3.5 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition w-fit"
          >
            {monthOptions.map(({ year, month }) => (
              <option key={`${year}-${month}`} value={`${year}-${month}`}>
                {ARABIC_MONTHS[month]} {year}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
            <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
          </div>
        ) : (
          <>
            {/* ── Summary cards ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard
                label="إيرادات الاشتراكات (جنيه)"
                value={Math.round(subscription).toLocaleString()}
                color="blue"
              />
              <StatCard
                label="إيرادات العربيات (جنيه)"
                value={Math.round(bus).toLocaleString()}
                color="purple"
              />
              <StatCard
                label="إجمالي المصاريف (جنيه)"
                value={totalExpenses.toLocaleString()}
                color="orange"
              />
              <StatCard
                label="إجمالي المرتبات (جنيه)"
                value={totalSalaries.toLocaleString()}
                color="red"
              />
              <StatCard
                label="صافي الربح (جنيه)"
                value={Math.round(netProfit).toLocaleString()}
                color={netProfit >= 0 ? "green" : "red"}
              />
            </div>

            {/* ── Bar chart (last 6 months) ──────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">
                مقارنة آخر 6 أشهر
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                  barCategoryGap="25%"
                  barGap={2}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                    width={40}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      `${Math.round(Number(value)).toLocaleString()} جنيه`,
                      name,
                    ]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                    formatter={(value) => <span style={{ color: "#374151" }}>{value}</span>}
                  />
                  <Bar dataKey="revenues" name="الإيرادات" fill="#f43f5e" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.isCurrent ? "#e11d48" : "#fda4af"} />
                    ))}
                  </Bar>
                  <Bar dataKey="costs" name="المصاريف" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.isCurrent ? "#2563eb" : "#93c5fd"} />
                    ))}
                  </Bar>
                  <Bar dataKey="profit" name="صافي الربح" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.profit >= 0
                            ? entry.isCurrent ? "#16a34a" : "#86efac"
                            : entry.isCurrent ? "#dc2626" : "#fca5a5"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-400 mt-2 text-center">
                الألوان الداكنة = {ARABIC_MONTHS[selMonth]} {selYear} (الشهر المحدد)
              </p>
            </div>

            {/* ── Breakdown sections (3 columns on desktop) ─────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Bus revenue by area */}
              <Section title="إيرادات العربيات حسب المنطقة">
                {Object.keys(busByArea).length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">لا توجد بيانات</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-right text-xs text-gray-500 border-b border-gray-100">
                        <th className="pb-2 font-semibold">المنطقة</th>
                        <th className="pb-2 font-semibold">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {Object.entries(busByArea)
                        .sort(([, a], [, b]) => b - a)
                        .map(([area, amount]) => (
                          <tr key={area}>
                            <td className="py-2 text-gray-700">{area}</td>
                            <td className="py-2 font-medium text-purple-700">
                              {Math.round(amount).toLocaleString()} ج
                            </td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 font-semibold text-xs">
                        <td className="pt-2 text-gray-600">الإجمالي</td>
                        <td className="pt-2 text-purple-700">
                          {Math.round(bus).toLocaleString()} ج
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </Section>

              {/* Expenses by type */}
              <Section title="المصاريف حسب النوع">
                {totalExpenses === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">لا توجد مصاريف</p>
                ) : (
                  <div className="space-y-3">
                    {(["rent", "bus", "other"] as const).map((type) => {
                      const amount = expByType[type] ?? 0;
                      const pct = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
                      return (
                        <div key={type}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600 font-medium">{EXPENSE_TYPE_LABELS[type]}</span>
                            <span className="font-semibold text-red-700">{amount.toLocaleString()} ج</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-400 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-right text-xs text-gray-400 mt-0.5">{pct}%</p>
                        </div>
                      );
                    })}
                    <div className="pt-1 border-t border-gray-100 flex justify-between text-xs font-semibold">
                      <span className="text-gray-600">الإجمالي</span>
                      <span className="text-red-700">{totalExpenses.toLocaleString()} ج</span>
                    </div>
                  </div>
                )}
              </Section>

              {/* Salaries this month */}
              <Section title="المرتبات المدفوعة">
                {salaryRows.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">لا توجد مرتبات مسجلة</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-right text-xs text-gray-500 border-b border-gray-100">
                        <th className="pb-2 font-semibold">الموظف</th>
                        <th className="pb-2 font-semibold">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {salaryRows.map((s) => (
                        <tr key={s.id}>
                          <td className="py-2">
                            <p className="text-gray-800 text-xs font-medium">{s.employee?.name}</p>
                            <p className="text-gray-400 text-xs">{ROLE_LABELS[s.employee!.role]}</p>
                          </td>
                          <td className="py-2 font-medium text-red-700 text-xs">
                            {s.amount.toLocaleString()} ج
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 font-semibold text-xs">
                        <td className="pt-2 text-gray-600">الإجمالي</td>
                        <td className="pt-2 text-red-700">{totalSalaries.toLocaleString()} ج</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </Section>
            </div>

            {/* ── Students with remaining balance ────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">
                  طلاب لم يدفعوا كامل المبلغ
                </h3>
                <span className="text-xs text-orange-600 font-semibold bg-orange-50 px-2 py-0.5 rounded-full">
                  {studentsWithBalance.length} طالب
                </span>
              </div>

              {studentsWithBalance.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <svg className="w-10 h-10 mx-auto mb-2 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-green-600">جميع الطلاب النشطين دفعوا كامل المبلغ</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-right">
                        <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">الاسم</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">الإجمالي</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">المدفوع</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">الباقي</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">تواصل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {studentsWithBalance.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                            {s.name}
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {s.totalAmount.toLocaleString()} ج
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-medium text-green-700">
                              {s.paidAmount.toLocaleString()} ج
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-semibold text-orange-600">
                              {s.remainingAmount.toLocaleString()} ج
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <a
                              href={`https://wa.me/2${s.phone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition"
                            >
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.096.539 4.063 1.479 5.772L0 24l6.404-1.456A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.032-1.388l-.36-.214-3.735.849.875-3.633-.235-.374A9.818 9.818 0 012.182 12C2.182 6.573 6.573 2.182 12 2.182S21.818 6.573 21.818 12 17.427 21.818 12 21.818z" />
                              </svg>
                              واتساب
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-orange-50 text-xs font-semibold">
                        <td className="px-4 py-3 text-gray-700">الإجمالي</td>
                        <td className="px-4 py-3 text-gray-700">
                          {studentsWithBalance.reduce((s, st) => s + st.totalAmount, 0).toLocaleString()} ج
                        </td>
                        <td className="px-4 py-3 text-green-700">
                          {studentsWithBalance.reduce((s, st) => s + st.paidAmount, 0).toLocaleString()} ج
                        </td>
                        <td className="px-4 py-3 text-orange-700">
                          {studentsWithBalance.reduce((s, st) => s + st.remainingAmount, 0).toLocaleString()} ج
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
