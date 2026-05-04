"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getCustomers, getPayments, getSales, getExpenses } from "../lib/firebaseUtils";
import { Customer, Payment, Sale, Expense } from "../lib/types";
import Navbar from "../components/Navbar";

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function StatCard({
  label,
  value,
  color,
  icon,
  href,
}: {
  label: string;
  value: string | number;
  color: "green" | "orange" | "blue" | "purple" | "red";
  icon: React.ReactNode;
  href?: string;
}) {
  const colors = {
    green:  { bg: "bg-green-50",  icon: "bg-green-100  text-green-600",  text: "text-green-700"  },
    orange: { bg: "bg-orange-50", icon: "bg-orange-100 text-orange-600", text: "text-orange-700" },
    blue:   { bg: "bg-blue-50",   icon: "bg-blue-100   text-blue-600",   text: "text-blue-700"   },
    purple: { bg: "bg-purple-50", icon: "bg-purple-100 text-purple-600", text: "text-purple-700" },
    red:    { bg: "bg-red-50",    icon: "bg-red-100    text-red-600",    text: "text-red-700"    },
  }[color];

  const inner = (
    <div className={`${colors.bg} rounded-2xl p-3 sm:p-6 flex flex-col sm:flex-row items-center gap-2 sm:gap-4 transition-transform duration-150 ${href ? "cursor-pointer hover:scale-[1.02]" : ""}`}>
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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  useEffect(() => {
    async function load() {
      const [c, p, s, e] = await Promise.all([
        getCustomers(),
        getPayments(),
        getSales(),
        getExpenses(),
      ]);
      setCustomers(c);
      setPayments(p);
      setSales(s);
      setExpenses(e);
      setLoading(false);
    }
    load();
  }, []);

  const monthOptions = useMemo(() => {
    const seen = new Set<string>();
    seen.add(`${now.getFullYear()}-${now.getMonth()}`);

    for (const c of customers) {
      const d = new Date(c.startDate);
      seen.add(`${d.getFullYear()}-${d.getMonth()}`);
    }
    for (const p of payments) {
      const d = new Date(p.date);
      seen.add(`${d.getFullYear()}-${d.getMonth()}`);
    }
    for (const s of sales) {
      const d = new Date(s.date);
      seen.add(`${d.getFullYear()}-${d.getMonth()}`);
    }
    for (const e of expenses) {
      const d = new Date(e.date);
      seen.add(`${d.getFullYear()}-${d.getMonth()}`);
    }

    return Array.from(seen)
      .map((key) => {
        const [y, m] = key.split("-").map(Number);
        return { year: y, month: m };
      })
      .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
  }, [customers, payments, sales, expenses]);

  const stats = useMemo(() => {
    const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
    const monthStart = `${monthPrefix}-01`;
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const monthEnd = `${monthPrefix}-${String(lastDay).padStart(2, "0")}`;

    function normalizeDate(raw: unknown): string {
      if (!raw) return "";
      // Firestore Timestamp: has seconds + nanoseconds
      if (typeof raw === "object" && raw !== null && "seconds" in raw) {
        const ts = raw as { seconds: number };
        return new Date(ts.seconds * 1000).toISOString().slice(0, 10);
      }
      // Firestore Timestamp with toDate() method
      if (typeof raw === "object" && raw !== null && "toDate" in raw) {
        return (raw as { toDate(): Date }).toDate().toISOString().slice(0, 10);
      }
      if (typeof raw === "string") return raw.slice(0, 10);
      return String(raw).slice(0, 10);
    }

    const filteredPayments = payments.filter((p) => {
      const d = normalizeDate(p.date);
      return d.startsWith(monthPrefix);
    });

    const subscriptionRevenue = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

    const activeMembers = customers.filter(
      (c) => c.startDate <= monthEnd && c.endDate >= monthStart
    ).length;

    const expiringSoon = customers.filter(
      (c) => c.endDate >= monthStart && c.endDate <= monthEnd
    ).length;

    const expiredThisMonth = customers.filter(
      (c) => c.endDate >= monthStart && c.endDate <= monthEnd && c.endDate < new Date().toISOString().split("T")[0]
    ).length;

    const salesRevenue = sales
      .filter((s) => { const d = normalizeDate(s.date); return d >= monthStart && d <= monthEnd; })
      .reduce((sum, s) => sum + (s.sellPrice ?? s.price), 0);

    const salesProfit = sales
      .filter((s) => { const d = normalizeDate(s.date); return d >= monthStart && d <= monthEnd; })
      .reduce((sum, s) => sum + (s.profit ?? ((s.sellPrice ?? s.price) - (s.costPrice ?? 0))), 0);

    const totalExpenses = expenses
      .filter((e) => { const d = normalizeDate(e.date); return d >= monthStart && d <= monthEnd; })
      .reduce((sum, e) => sum + e.price, 0);

    const netProfit = subscriptionRevenue + salesProfit - totalExpenses;

    return { activeMembers, expiringSoon, subscriptionRevenue, expiredThisMonth, salesRevenue, totalExpenses, netProfit };
  }, [customers, payments, sales, expenses, selectedYear, selectedMonth]);

  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

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
            {[...Array(7)].map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-2xl h-24 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="الأعضاء النشطون"
              value={stats.activeMembers}
              color="green"
              href={isCurrentMonth ? "/customers?filter=active" : undefined}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
            <StatCard
              label="اشتراكات تنتهي هذا الشهر"
              value={stats.expiringSoon}
              color="orange"
              href={isCurrentMonth ? "/customers?filter=expiring" : undefined}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="إيرادات الاشتراكات (جنيه)"
              value={stats.subscriptionRevenue.toLocaleString()}
              color="blue"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="اشتراكات منتهية"
              value={stats.expiredThisMonth}
              color="red"
              href="/customers?filter=expired"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="إيرادات المبيعات (جنيه)"
              value={stats.salesRevenue.toLocaleString()}
              color="green"
              href="/sales"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            />
            <StatCard
              label="المصاريف (جنيه)"
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
              color="blue"
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
