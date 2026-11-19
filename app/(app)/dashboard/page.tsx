"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { buildMonthOptions, currentMonth, monthOfDate, monthStart } from "../../lib/dates";
import { monthSummary } from "../../lib/finance";
import { useData } from "../../lib/store";
import { formatMoney } from "../../lib/text";
import { MonthSelect } from "../../components/ui";

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
  const {
    students, payments, expenses, salaries, employees,
    paymentsFrom, earliestPaymentDate, ensurePaymentsFrom,
  } = useData();
  const [selected, setSelected] = useState(currentMonth);

  // دفعات الشهور القديمة بتتحمّل بس لما تختار شهر قديم.
  const neededFrom = monthStart(selected);
  const paymentsLoaded = payments !== null;
  useEffect(() => {
    if (paymentsLoaded) ensurePaymentsFrom(neededFrom);
  }, [paymentsLoaded, neededFrom, ensurePaymentsFrom]);

  const monthOptions = useMemo(
    () => buildMonthOptions([
      earliestPaymentDate ? monthOfDate(earliestPaymentDate) : null,
      ...(expenses ?? []),
      ...(salaries ?? []),
    ]),
    [earliestPaymentDate, expenses, salaries]
  );

  const stats = useMemo(() => {
    if (!students || !payments || !expenses || !salaries || !employees) return null;
    if (paymentsFrom > neededFrom) return null; // لسه بنحمّل دفعات الشهر ده

    const summary = monthSummary(selected, { payments, expenses, salaries, employees });
    return {
      ...summary,
      // الحالة الحالية للطلاب (مش مرتبطة بالشهر المختار)
      activeStudents: students.filter((s) => s.status === "active").length,
      expiredStudents: students.filter((s) => s.status === "inactive").length,
      // الباقي على كل الطلاب، شامل اللي اشتراكهم انتهى ولسه عليهم فلوس
      remaining: students.reduce((sum, s) => sum + s.remainingAmount, 0),
    };
  }, [students, payments, expenses, salaries, employees, paymentsFrom, neededFrom, selected]);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">نظرة عامة</h2>
          <p className="text-sm text-gray-500 mt-0.5">ملخص النشاط الشهري للحضانة</p>
        </div>
        <MonthSelect value={selected} options={monthOptions} onChange={setSelected} />
      </div>

      {/* ── Cards ───────────────────────────────────────────────────────── */}
      {!stats ? (
        <div className="grid grid-cols-2 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-2xl h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="إجمالي الطلاب النشطين"
            value={stats.activeStudents}
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
            value={formatMoney(stats.revenue)}
            color="#16a34a"
          />
          <StatCard
            label="المبالغ المتبقية على الطلاب (جنيه)"
            value={formatMoney(stats.remaining)}
            color="#ea580c"
          />
          <StatCard
            label="إجمالي المصاريف (جنيه)"
            value={formatMoney(stats.expenses)}
            color="#dc2626"
            href="/expenses"
          />
          <StatCard
            label="إجمالي المرتبات (جنيه)"
            value={formatMoney(stats.salaries)}
            color="#be123c"
            href="/employees"
          />
          <StatCard
            label="صافي الربح (جنيه)"
            value={formatMoney(stats.netProfit)}
            color={stats.netProfit >= 0 ? "#15803d" : "#dc2626"}
          />
          <StatCard
            label="اشتراكات منتهية — يحتاجون تجديد"
            value={`${stats.expiredStudents} طالب`}
            color="#b45309"
            href="/students"
          />
        </div>
      )}
    </main>
  );
}
