"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { getCustomers, getPayments, getExpenses } from "../lib/firebaseUtils";
import { Customer, Payment, Expense } from "../lib/types";
import Navbar from "../components/Navbar";

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function normalizeDate(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "object" && raw !== null && "seconds" in raw) {
    return new Date((raw as { seconds: number }).seconds * 1000).toISOString().slice(0, 10);
  }
  if (typeof raw === "object" && raw !== null && "toDate" in raw) {
    return (raw as { toDate(): Date }).toDate().toISOString().slice(0, 10);
  }
  if (typeof raw === "string") return raw.slice(0, 10);
  return String(raw).slice(0, 10);
}

function StatCard({
  label,
  value,
  color,
  icon,
  href,
}: {
  label: string;
  value: string | number;
  color: "green" | "orange" | "blue" | "red";
  icon: React.ReactNode;
  href?: string;
}) {
  const colors = {
    green:  { bg: "bg-green-50",  icon: "bg-green-100  text-green-600",  text: "text-green-700"  },
    orange: { bg: "bg-orange-50", icon: "bg-orange-100 text-orange-600", text: "text-orange-700" },
    blue:   { bg: "bg-blue-50",   icon: "bg-blue-100   text-blue-600",   text: "text-blue-700"   },
    red:    { bg: "bg-red-50",    icon: "bg-red-100    text-red-600",    text: "text-red-700"    },
  }[color];

  const inner = (
    <div className={`${colors.bg} rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-2 sm:gap-4 ${href ? "cursor-pointer hover:scale-[1.02] transition-transform duration-150" : ""}`}>
      <div className={`${colors.icon} rounded-xl p-2 sm:p-3 shrink-0`}>{icon}</div>
      <div className="text-center sm:text-right">
        <p className="text-xs sm:text-sm text-gray-500 font-medium leading-snug">{label}</p>
        <p className={`text-lg sm:text-2xl font-bold ${colors.text}`}>{value}</p>
      </div>
    </div>
  );

  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

export default function DashboardPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/");
      } else {
        setAuthChecked(true);
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!authChecked) return;
    async function load() {
      const [c, p, e] = await Promise.all([
        getCustomers(),
        getPayments(),
        getExpenses(),
      ]);
      setCustomers(c);
      setPayments(p);
      setExpenses(e);
      setLoading(false);
    }
    load();
  }, [authChecked]);

  const monthOptions = useMemo(() => {
    const seen = new Set<string>();
    seen.add(`${now.getFullYear()}-${now.getMonth()}`);
    for (const p of payments) {
      const d = new Date(normalizeDate(p.date));
      if (!isNaN(d.getTime())) seen.add(`${d.getFullYear()}-${d.getMonth()}`);
    }
    for (const e of expenses) {
      const d = new Date(normalizeDate(e.date));
      if (!isNaN(d.getTime())) seen.add(`${d.getFullYear()}-${d.getMonth()}`);
    }
    return Array.from(seen)
      .map((key) => {
        const [y, m] = key.split("-").map(Number);
        return { year: y, month: m };
      })
      .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
  }, [payments, expenses]);

  const stats = useMemo(() => {
    const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
    const monthStart = `${monthPrefix}-01`;
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const monthEnd = `${monthPrefix}-${String(lastDay).padStart(2, "0")}`;

    const activeStudents = customers.filter(
      (c) => c.startDate <= monthEnd && c.endDate >= monthStart
    );
    const totalActiveStudents = activeStudents.length;

    const monthPayments = payments.filter((p) => normalizeDate(p.date).startsWith(monthPrefix));
    const subscriptionCount = monthPayments.length;
    const collected = monthPayments.reduce((sum, p) => sum + p.amount, 0);

    const totalExpected = activeStudents.reduce((sum, c) => sum + c.price, 0);
    const remaining = Math.max(0, totalExpected - collected);

    const totalExpenses = expenses
      .filter((e) => {
        const d = normalizeDate(e.date);
        return d >= monthStart && d <= monthEnd;
      })
      .reduce((sum, e) => sum + e.price, 0);

    const netProfit = collected - totalExpenses;

    return { totalActiveStudents, subscriptionCount, collected, remaining, totalExpenses, netProfit };
  }, [customers, payments, expenses, selectedYear, selectedMonth]);

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-gray-900">نظرة عامة</h2>
          <select
            value={`${selectedYear}-${selectedMonth}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split("-").map(Number);
              setSelectedYear(y);
              setSelectedMonth(m);
            }}
            className="px-3.5 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          >
            {monthOptions.map(({ year, month }) => (
              <option key={`${year}-${month}`} value={`${year}-${month}`}>
                {ARABIC_MONTHS[month]} {year}
              </option>
            ))}
          </select>
        </div>

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
              color="green"
              href="/students"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
            <StatCard
              label="إجمالي الاشتراكات هذا الشهر"
              value={stats.subscriptionCount}
              color="blue"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
            />
            <StatCard
              label="المبالغ المحصلة (جنيه)"
              value={stats.collected.toLocaleString()}
              color="blue"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="المبالغ المتبقية (جنيه)"
              value={stats.remaining.toLocaleString()}
              color="orange"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="إجمالي المصاريف (جنيه)"
              value={stats.totalExpenses.toLocaleString()}
              color="red"
              href="/expenses"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            />
            <StatCard
              label="صافي الربح (جنيه)"
              value={stats.netProfit.toLocaleString()}
              color={stats.netProfit >= 0 ? "green" : "red"}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
            />
          </div>
        )}
      </main>
    </div>
  );
}
