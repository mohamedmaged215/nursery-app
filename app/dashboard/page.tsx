"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import Navbar from "../components/Navbar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  status: "active" | "inactive";
  remainingAmount: number;
}

interface Payment {
  id: string;
  studentId: string;
  amount: number;
  date: string;
}

interface Expense {
  id: string;
  amount: number;
  month: number; // 0-indexed
  year: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

// ─── Firestore ────────────────────────────────────────────────────────────────

async function fetchCollection<T>(name: string): Promise<T[]> {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  href,
}: {
  label: string;
  value: string | number;
  color: string;
  href?: string;
}) {
  const inner = (
    <div
      className={`bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-sm ${href ? "cursor-pointer hover:shadow-md transition-shadow duration-150" : ""}`}
      style={{ borderLeftWidth: "4px", borderLeftColor: color }}
    >
      <p className="text-xs sm:text-sm text-gray-500 font-medium leading-snug mb-1.5">{label}</p>
      <p className="text-xl sm:text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  );

  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [students,  setStudents]  = useState<Student[]>([]);
  const [payments,  setPayments]  = useState<Payment[]>([]);
  const [expenses,  setExpenses]  = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

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
    Promise.all([
      fetchCollection<Student>("students"),
      fetchCollection<Payment>("payments"),
      fetchCollection<Expense>("expenses"),
    ]).then(([s, p, e]) => {
      setStudents(s);
      setPayments(p);
      setExpenses(e);
      setLoading(false);
    });
  }, [authChecked]);

  // ── Month options ──────────────────────────────────────────────────────────
  const monthOptions = useMemo(() => {
    const seen = new Set<string>();
    seen.add(`${now.getFullYear()}-${now.getMonth()}`);
    for (const p of payments) {
      if (p.date) {
        const d = new Date(p.date);
        if (!isNaN(d.getTime())) seen.add(`${d.getFullYear()}-${d.getMonth()}`);
      }
    }
    for (const e of expenses) {
      if (e.year != null && e.month != null) seen.add(`${e.year}-${e.month}`);
    }
    return Array.from(seen)
      .map((k) => { const [y, m] = k.split("-").map(Number); return { year: y, month: m }; })
      .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, expenses]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

    // Active students (status-based, no month filter — current snapshot)
    const activeStudents = students.filter((s) => s.status === "active");
    const totalActiveStudents = activeStudents.length;

    // Remaining = sum of remainingAmount for active students only
    const remaining = activeStudents.reduce((sum, s) => sum + (s.remainingAmount || 0), 0);

    // Collected = sum of payment amounts in selected month
    const monthPayments = payments.filter((p) => p.date?.startsWith(monthPrefix));
    const collected = monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const paymentCount = monthPayments.length;

    // Expenses = sum of expenses for selected month (using month/year fields)
    const totalExpenses = expenses
      .filter((e) => e.month === selectedMonth && e.year === selectedYear)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const netProfit = collected - totalExpenses;

    return { totalActiveStudents, paymentCount, collected, remaining, totalExpenses, netProfit };
  }, [students, payments, expenses, selectedYear, selectedMonth]);

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
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">نظرة عامة</h2>
            <p className="text-sm text-gray-500 mt-0.5">ملخص النشاط الشهري للحضانة</p>
          </div>
          <select
            value={`${selectedYear}-${selectedMonth}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split("-").map(Number);
              setSelectedYear(y);
              setSelectedMonth(m);
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

        {/* ── Cards ───────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-2xl h-24 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="إجمالي الطلاب النشطين"
              value={stats.totalActiveStudents}
              color="#1976d2"
              href="/students"
            />
            <StatCard
              label="عدد الدفعات هذا الشهر"
              value={stats.paymentCount}
              color="#7c3aed"
            />
            <StatCard
              label="المبالغ المحصلة (جنيه)"
              value={stats.collected.toLocaleString()}
              color="#16a34a"
            />
            <StatCard
              label="المبالغ المتبقية (جنيه)"
              value={stats.remaining.toLocaleString()}
              color="#ea580c"
            />
            <StatCard
              label="إجمالي المصاريف (جنيه)"
              value={stats.totalExpenses.toLocaleString()}
              color="#dc2626"
              href="/expenses"
            />
            <StatCard
              label="صافي الربح (جنيه)"
              value={stats.netProfit.toLocaleString()}
              color={stats.netProfit >= 0 ? "#15803d" : "#dc2626"}
            />
          </div>
        )}
      </main>
    </div>
  );
}
