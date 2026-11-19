"use client";

import { useMemo, useState } from "react";
import { addDays, todayISO } from "../../lib/dates";
import { useData } from "../../lib/store";
import { formatMoney, normalizeDigits, normalizeForSearch, whatsappLink } from "../../lib/text";
import type { Student } from "../../lib/types";
import { TableSkeleton } from "../../components/ui";
import {
  BusGroupModal,
  DEFAULT_BUS_AREAS,
  DeleteStudentModal,
  PaymentModal,
  RenewalModal,
  StudentDetailsModal,
  StudentFormModal,
  typeLabel,
} from "./modals";

/** قبل نهاية الاشتراك بكام يوم يظهر التنبيه وزرار التجديد. */
const EXPIRING_SOON_DAYS = 5;

type Dialog =
  | { kind: "add" }
  | { kind: "edit" | "details" | "pay" | "renew" | "delete"; id: string }
  | { kind: "bus"; area: string };

function expiredMessage(student: Student): string {
  return `السلام عليكم مع حضرتك إدارة الحضانة\nبنفكر حضرتك إن اشتراك الطفل ${student.name} انتهى\nبرجاء تجديد الاشتراك\nمع تحيات إدارة Mr Kids`;
}

const actionCls = "px-2.5 py-1.5 rounded-lg text-xs font-semibold transition";

export default function StudentsPage() {
  const { students } = useData();
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const today = todayISO();
  const soonLimit = addDays(today, EXPIRING_SOON_DAYS);
  const query = normalizeForSearch(search);

  const filtered = useMemo(
    () =>
      (students ?? [])
        .filter((s) => s.status === tab)
        .filter(
          (s) =>
            !query ||
            normalizeForSearch(s.name).includes(query) ||
            normalizeDigits(s.phone).includes(query)
        )
        .sort((a, b) => a.name.localeCompare(b.name, "ar")),
    [students, tab, query]
  );

  // العربيات الأساسية + أي عربية مكتوبة لطالب.
  const busAreas = useMemo(() => {
    const areas = new Set(DEFAULT_BUS_AREAS);
    for (const s of students ?? []) if (s.type === "bus" && s.area) areas.add(s.area);
    return Array.from(areas);
  }, [students]);

  const activeCount   = students?.filter((s) => s.status === "active").length ?? 0;
  const inactiveCount = students?.filter((s) => s.status === "inactive").length ?? 0;

  const close = () => setDialog(null);
  // الطالب بيتجاب من البيانات الحالية كل مرة، فالنافذة دايمًا بتعرض أحدث أرقامه.
  const dialogStudent =
    dialog && "id" in dialog ? students?.find((s) => s.id === dialog.id) ?? null : null;

  return (
    <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">الطلاب</h2>
            <p className="text-sm text-gray-500 mt-0.5">إدارة بيانات الطلاب والمدفوعات</p>
          </div>
          <button
            onClick={() => setDialog({ kind: "add" })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1976d2] text-white text-sm font-bold hover:bg-blue-700 transition w-fit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            إضافة طالب
          </button>
        </div>

        {/* ── Tabs + Search ────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit shrink-0">
            <button onClick={() => setTab("active")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                tab === "active" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              نشط ({activeCount})
            </button>
            <button onClick={() => setTab("inactive")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                tab === "inactive" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              اشتراكات منتهية ({inactiveCount})
            </button>
          </div>
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الموبايل..."
            className="w-full sm:max-w-xs px-3.5 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        {/* ── Table ───────────────────────────────────────────────────────── */}
        {!students ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <svg className="w-14 h-14 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm font-medium">
              {query ? "لا توجد نتائج للبحث" : tab === "inactive" ? "لا توجد اشتراكات منتهية" : "لا يوجد طلاب نشطين"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-right">
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">الاسم</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">موبايل ولي الأمر</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">نوع الاشتراك</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">مبلغ الاشتراك</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">المدفوع</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">الباقي</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">
                      {tab === "active" ? "ينتهي" : "تاريخ الانتهاء"}
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((student) => {
                    const isActive = student.status === "active";
                    const expiringSoon = isActive && !!student.endDate && student.endDate <= soonLimit;
                    return (
                      <tr key={student.id} className={`hover:bg-gray-50 transition ${isActive ? "" : "opacity-75"}`}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button onClick={() => setDialog({ kind: "details", id: student.id })}
                            className="font-medium text-[#1976d2] hover:underline text-right">
                            {student.name}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap" dir="ltr">{student.phone}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {student.type === "bus" ? (
                            <button
                              onClick={() => setDialog({ kind: "bus", area: student.area })}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 underline transition"
                            >
                              {typeLabel(student)}
                            </button>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              {typeLabel(student)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                          {formatMoney(student.subscriptionAmount)}
                          {student.previousDebt > 0 && (
                            <span className="text-xs text-orange-600"> + {formatMoney(student.previousDebt)} سابقة</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-medium text-green-700">{formatMoney(student.paidAmount)}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`font-medium ${student.remainingAmount > 0 ? "text-orange-600" : "text-green-600"}`}>
                            {formatMoney(student.remainingAmount)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          {student.endDate ? (
                            <span className={expiringSoon ? "text-red-600 font-semibold" : "text-gray-500"}>
                              {student.endDate}{expiringSoon && " ⚠"}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {student.remainingAmount > 0 && (
                              <button onClick={() => setDialog({ kind: "pay", id: student.id })}
                                className={`${actionCls} bg-green-50 text-green-700 hover:bg-green-100`}>
                                دفع
                              </button>
                            )}
                            {(!isActive || expiringSoon) && (
                              <button onClick={() => setDialog({ kind: "renew", id: student.id })}
                                className={`${actionCls} bg-blue-50 text-blue-700 hover:bg-blue-100`}>
                                تجديد
                              </button>
                            )}
                            {!isActive && (
                              <a href={whatsappLink(student.phone, expiredMessage(student))}
                                target="_blank" rel="noopener noreferrer"
                                className={`${actionCls} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}>
                                واتساب
                              </a>
                            )}
                            <button onClick={() => setDialog({ kind: "edit", id: student.id })}
                              className={`${actionCls} bg-yellow-50 text-yellow-700 hover:bg-yellow-100`}>
                              تعديل
                            </button>
                            <button onClick={() => setDialog({ kind: "delete", id: student.id })}
                              className={`${actionCls} bg-red-50 text-red-600 hover:bg-red-100`}>
                              حذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
              {filtered.length} طالب
            </div>
          </div>
        )}
      </main>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {dialog?.kind === "add" && <StudentFormModal busAreas={busAreas} onClose={close} />}
      {dialog?.kind === "edit" && dialogStudent && (
        <StudentFormModal student={dialogStudent} busAreas={busAreas} onClose={close} />
      )}
      {dialog?.kind === "details" && dialogStudent && (
        <StudentDetailsModal student={dialogStudent} onClose={close} />
      )}
      {dialog?.kind === "pay" && dialogStudent && <PaymentModal student={dialogStudent} onClose={close} />}
      {dialog?.kind === "renew" && dialogStudent && (
        <RenewalModal student={dialogStudent} busAreas={busAreas} onClose={close} />
      )}
      {dialog?.kind === "delete" && dialogStudent && (
        <DeleteStudentModal student={dialogStudent} onClose={close} />
      )}
      {dialog?.kind === "bus" && students && (
        <BusGroupModal area={dialog.area} students={students} onClose={close} />
      )}
    </>
  );
}
