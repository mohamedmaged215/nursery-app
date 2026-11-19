"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import {
  ARABIC_MONTHS, buildMonthOptions, currentMonth, monthLabel, monthOfDate, monthStart, shiftMonth,
} from "../../lib/dates";
import { monthSummary, type MonthSummary } from "../../lib/finance";
import { useData } from "../../lib/store";
import { formatMoney, whatsappLink } from "../../lib/text";
import type { EmployeeRole, Student } from "../../lib/types";
import { MonthSelect } from "../../components/ui";

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  supplies: "هوالك",
  rent:     "إيجار",
};

const ROLE_LABELS: Record<EmployeeRole, string> = {
  teacher: "معلمة", driver: "سايق", other: "أخرى",
};

/** عدد الشهور في الرسم البياني (الشهر المختار واللي قبله). */
const CHART_MONTHS = 6;

// ─── Summary Card ─────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: {
  label: string; value: string;
  color: "green" | "blue" | "red" | "orange" | "purple";
}) {
  const cls = {
    green:  { bg: "bg-green-50",  text: "text-green-700"  },
    blue:   { bg: "bg-blue-50",   text: "text-blue-700"   },
    red:    { bg: "bg-red-50",    text: "text-red-700"    },
    orange: { bg: "bg-orange-50", text: "text-orange-700" },
    purple: { bg: "bg-purple-50", text: "text-purple-700" },
  }[color];
  return (
    <div className={`${cls.bg} rounded-2xl p-4 sm:p-5`}>
      <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1 leading-snug">{label}</p>
      <p className={`text-lg sm:text-xl font-bold ${cls.text}`}>{value}</p>
    </div>
  );
}

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
  const {
    students, payments, expenses, salaries, employees,
    paymentsFrom, earliestPaymentDate, ensurePaymentsFrom,
  } = useData();
  const [selected, setSelected] = useState(currentMonth);

  // الرسم محتاج دفعات آخر 6 شهور قبل الشهر المختار؛ الأقدم بيتحمّل عند الحاجة.
  const neededFrom = monthStart(shiftMonth(selected, -(CHART_MONTHS - 1)));
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

  const report = useMemo(() => {
    if (!students || !payments || !expenses || !salaries || !employees) return null;
    if (paymentsFrom > neededFrom) return null; // لسه بنحمّل دفعات الفترة دي
    const data = { payments, expenses, salaries, employees };

    const chartData = [];
    for (let i = CHART_MONTHS - 1; i >= 0; i--) {
      const ref = shiftMonth(selected, -i);
      const m = monthSummary(ref, data);
      chartData.push({
        name: ARABIC_MONTHS[ref.month].slice(0, 3),
        revenues: m.revenue,
        costs: m.expenses + m.salaries,
        profit: m.netProfit,
        isCurrent: i === 0,
      });
    }

    // كل طالب عليه باقي، شامل اللي اشتراكهم انتهى
    const studentsWithBalance = students
      .filter((s) => s.remainingAmount > 0)
      .sort((x, y) => y.remainingAmount - x.remainingAmount);

    return { month: monthSummary(selected, data), chartData, studentsWithBalance };
  }, [students, payments, expenses, salaries, employees, paymentsFrom, neededFrom, selected]);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">

      {/* ── Header + month selector ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">التقارير</h2>
          <p className="text-sm text-gray-500 mt-0.5">تقرير مالي شهري تفصيلي</p>
        </div>
        <MonthSelect value={selected} options={monthOptions} onChange={setSelected} />
      </div>

      {!report ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
          <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      ) : (
        <ReportBody selectedLabel={monthLabel(selected)} {...report} />
      )}
    </main>
  );
}

// ─── Report body ──────────────────────────────────────────────────────────────

interface ChartRow {
  name: string;
  revenues: number;
  costs: number;
  profit: number;
  isCurrent: boolean;
}

function ReportBody({
  selectedLabel,
  month,
  chartData,
  studentsWithBalance,
}: {
  selectedLabel: string;
  month: MonthSummary;
  chartData: ChartRow[];
  studentsWithBalance: Student[];
}) {
  const sumBalance = (pick: (s: Student) => number) =>
    studentsWithBalance.reduce((sum, s) => sum + pick(s), 0);

  // الأنواع الأساسية دايمًا ظاهرة، وأي نوع قديم تاني بيظهر تحت "أخرى".
  const knownTypes = Object.keys(EXPENSE_TYPE_LABELS);
  const otherExpenses = Object.entries(month.expensesByType)
    .filter(([type]) => !knownTypes.includes(type))
    .reduce((sum, [, amount]) => sum + amount, 0);
  const expenseRows = [
    ...knownTypes.map((type) => ({ label: EXPENSE_TYPE_LABELS[type], amount: month.expensesByType[type] ?? 0 })),
    ...(otherExpenses > 0 ? [{ label: "أخرى", amount: otherExpenses }] : []),
  ];

  return (
    <>
      {/* ── Summary cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="إيرادات الاشتراكات (جنيه)" value={formatMoney(Math.round(month.revenue))} color="blue" />
        <StatCard label="إجمالي المصاريف (جنيه)" value={formatMoney(month.expenses)} color="orange" />
        <StatCard label="إجمالي المرتبات (جنيه)" value={formatMoney(month.salaries)} color="red" />
        <StatCard
          label="صافي الربح (جنيه)"
          value={formatMoney(Math.round(month.netProfit))}
          color={month.netProfit >= 0 ? "green" : "red"}
        />
      </div>

      {/* ── Bar chart ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">مقارنة آخر 6 أشهر</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            barCategoryGap="25%" barGap={2}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={40} />
            <Tooltip
              formatter={(value, name) => [`${formatMoney(Math.round(Number(value)))} جنيه`, name]}
              contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
              formatter={(value) => <span style={{ color: "#374151" }}>{value}</span>} />
            <Bar dataKey="revenues" name="الإيرادات" fill="#f43f5e" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.isCurrent ? "#e11d48" : "#fda4af"} />
              ))}
            </Bar>
            <Bar dataKey="costs" name="المصاريف والمرتبات" fill="#3b82f6" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.isCurrent ? "#2563eb" : "#93c5fd"} />
              ))}
            </Bar>
            <Bar dataKey="profit" name="صافي الربح" fill="#16a34a" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={
                  entry.profit >= 0
                    ? entry.isCurrent ? "#16a34a" : "#86efac"
                    : entry.isCurrent ? "#dc2626" : "#fca5a5"
                } />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-400 mt-2 text-center">
          الألوان الداكنة = {selectedLabel} (الشهر المحدد)
        </p>
      </div>

      {/* ── Breakdown sections ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Expenses by type */}
        <Section title="المصاريف حسب النوع">
          {month.expenses === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">لا توجد مصاريف</p>
          ) : (
            <div className="space-y-3">
              {expenseRows.map(({ label, amount }) => {
                const pct = Math.round((amount / month.expenses) * 100);
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 font-medium">{label}</span>
                      <span className="font-semibold text-red-700">{formatMoney(amount)} ج</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-right text-xs text-gray-400 mt-0.5">{pct}%</p>
                  </div>
                );
              })}
              <div className="pt-1 border-t border-gray-100 flex justify-between text-xs font-semibold">
                <span className="text-gray-600">الإجمالي</span>
                <span className="text-red-700">{formatMoney(month.expenses)} ج</span>
              </div>
            </div>
          )}
        </Section>

        {/* Salaries this month */}
        <Section title="المرتبات المدفوعة">
          {month.salaryRows.length === 0 ? (
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
                {month.salaryRows.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2">
                      <p className="text-gray-800 text-xs font-medium">{s.employee.name}</p>
                      <p className="text-gray-400 text-xs">{ROLE_LABELS[s.employee.role]}</p>
                    </td>
                    <td className="py-2 font-medium text-red-700 text-xs">
                      {formatMoney(s.amount)} ج
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 font-semibold text-xs">
                  <td className="pt-2 text-gray-600">الإجمالي</td>
                  <td className="pt-2 text-red-700">{formatMoney(month.salaries)} ج</td>
                </tr>
              </tfoot>
            </table>
          )}
        </Section>
      </div>

      {/* ── Students with remaining balance ────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">طلاب لم يدفعوا كامل المبلغ</h3>
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
            <p className="text-sm font-medium text-green-600">جميع الطلاب دفعوا كامل المبلغ</p>
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
                      {s.status === "inactive" && (
                        <span className="mr-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                          اشتراك منتهي
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatMoney(s.totalAmount)} ج</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-green-700">{formatMoney(s.paidAmount)} ج</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-semibold text-orange-600">{formatMoney(s.remainingAmount)} ج</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <a href={whatsappLink(s.phone)}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition">
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
                  <td className="px-4 py-3 text-gray-700">{formatMoney(sumBalance((s) => s.totalAmount))} ج</td>
                  <td className="px-4 py-3 text-green-700">{formatMoney(sumBalance((s) => s.paidAmount))} ج</td>
                  <td className="px-4 py-3 text-orange-700">{formatMoney(sumBalance((s) => s.remainingAmount))} ج</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
