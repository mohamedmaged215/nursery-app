"use client";

import { useMemo, useState } from "react";
import { ARABIC_MONTHS, buildMonthOptions, currentMonth } from "../../lib/dates";
import { useData } from "../../lib/store";
import { formatMoney } from "../../lib/text";
import type { Employee, EmployeeRole, Salary } from "../../lib/types";
import {
  CloseButton,
  ErrorText,
  Field,
  Modal,
  ModalActions,
  MonthSelect,
  TableSkeleton,
  inputCls,
} from "../../components/ui";

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<EmployeeRole, string> = {
  teacher: "معلمة",
  driver: "سايق",
  other: "أخرى",
};

const ROLE_BADGE: Record<EmployeeRole, string> = {
  teacher: "bg-purple-100 text-purple-700",
  driver:  "bg-blue-100   text-blue-700",
  other:   "bg-gray-100   text-gray-600",
};

const SAVE_ERROR = "حدث خطأ أثناء الحفظ. حاول مرة أخرى.";

// ─── Add / Edit Employee Modal ────────────────────────────────────────────────

function EmployeeFormModal({ employee, onClose }: { employee?: Employee; onClose: () => void }) {
  const { saveEmployee } = useData();
  const isEdit = !!employee;
  const [name, setName] = useState(employee?.name ?? "");
  const [role, setRole] = useState<EmployeeRole>(employee?.role ?? "teacher");
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
      await saveEmployee({ name: name.trim(), role, monthlySalary: salary }, employee?.id);
      onClose();
    } catch {
      setError(SAVE_ERROR);
      setSaving(false);
    }
  }

  return (
    <Modal title={isEdit ? "تعديل بيانات الموظف" : "إضافة موظف جديد"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="اسم الموظف *">
          <input
            type="text" required value={name} onChange={(e) => setName(e.target.value)}
            placeholder="أدخل اسم الموظف" className={inputCls}
          />
        </Field>

        <Field label="الوظيفة *">
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
        </Field>

        <Field label="المرتب الشهري (جنيه) *">
          <input
            type="number" min="1" required dir="ltr"
            value={monthlySalary} onChange={(e) => setMonthlySalary(e.target.value)}
            placeholder="0" className={inputCls}
          />
        </Field>

        <ErrorText>{error}</ErrorText>
        <ModalActions onCancel={onClose} busy={saving} submitLabel={isEdit ? "حفظ التعديلات" : "إضافة"} />
      </form>
    </Modal>
  );
}

// ─── Employee Details Modal ───────────────────────────────────────────────────

function EmployeeDetailsModal({
  employee,
  salaries,
  onClose,
}: {
  employee: Employee;
  salaries: Salary[];
  onClose: () => void;
}) {
  const { removeSalary } = useData();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const empSalaries = useMemo(
    () => salaries
      .filter((s) => s.employeeId === employee.id)
      .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month)),
    [salaries, employee.id]
  );

  async function handleDeleteSalary(id: string) {
    setError("");
    setDeletingId(id);
    try {
      await removeSalary(id);
    } catch {
      setError("حدث خطأ أثناء حذف المرتب. حاول مرة أخرى.");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  return (
    <Modal title="تفاصيل الموظف" onClose={onClose}>
      {/* Employee info */}
      <div className="bg-gray-50 rounded-xl px-4 py-4 mb-5 space-y-2">
        <p className="text-base font-bold text-gray-900">{employee.name}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <span className="text-gray-500">الوظيفة</span>
          <span className="font-medium text-gray-700">{ROLE_LABELS[employee.role]}</span>
          <span className="text-gray-500">المرتب الشهري</span>
          <span className="font-medium text-gray-700">{formatMoney(employee.monthlySalary)} ج</span>
          <span className="text-gray-500">تاريخ الإضافة</span>
          <span className="font-medium text-gray-700">{employee.createdAt || "—"}</span>
        </div>
      </div>

      {/* Salary history */}
      <h3 className="text-sm font-bold text-gray-700 mb-3">سجل المرتبات المدفوعة</h3>
      {empSalaries.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">لا توجد مرتبات مسجلة</p>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 font-semibold text-gray-600 text-right">الشهر</th>
                <th className="px-3 py-2 font-semibold text-gray-600 text-right">تاريخ الدفع</th>
                <th className="px-3 py-2 font-semibold text-gray-600 text-right">المبلغ</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {empSalaries.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 text-gray-700 font-medium">
                    {ARABIC_MONTHS[s.month]} {s.year}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{s.date}</td>
                  <td className="px-3 py-2 font-semibold text-green-700">{formatMoney(s.amount)} ج</td>
                  <td className="px-3 py-2 text-left whitespace-nowrap">
                    {confirmId === s.id ? (
                      <>
                        <button onClick={() => handleDeleteSalary(s.id)} disabled={deletingId === s.id}
                          className="text-red-600 font-bold hover:underline disabled:opacity-60">
                          {deletingId === s.id ? "..." : "تأكيد الحذف"}
                        </button>
                        <button onClick={() => setConfirmId(null)} className="text-gray-500 hover:underline mr-3">
                          إلغاء
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmId(s.id)} className="text-red-500 hover:underline">
                        حذف
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && <div className="mt-3"><ErrorText>{error}</ErrorText></div>}

      <CloseButton onClose={onClose} />
    </Modal>
  );
}

// ─── Salary Modal ─────────────────────────────────────────────────────────────

function SalaryModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const { addSalary } = useData();
  const now = currentMonth();
  const [selMonth, setSelMonth] = useState(now.month);
  const [selYear, setSelYear]   = useState(now.year);
  const [amount, setAmount]     = useState(String(employee.monthlySalary));
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  const years = [now.year, now.year - 1];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) { setError("يرجى إدخال مبلغ صحيح"); return; }
    setSaving(true);
    try {
      await addSalary({ employeeId: employee.id, amount: amt, month: selMonth, year: selYear });
      onClose();
    } catch {
      setError(SAVE_ERROR);
      setSaving(false);
    }
  }

  const selectCls =
    "px-3 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";

  return (
    <Modal title="تسجيل مرتب" size="sm" onClose={onClose}>
      <div className="bg-gray-50 rounded-xl px-4 py-3 mb-5">
        <p className="text-sm font-semibold text-gray-900">{employee.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {ROLE_LABELS[employee.role]}
          {" · "}المرتب الأساسي: {formatMoney(employee.monthlySalary)} جنيه
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="الشهر">
          <div className="flex gap-2">
            <select
              value={selMonth} onChange={(e) => setSelMonth(Number(e.target.value))}
              className={`flex-1 ${selectCls}`}
            >
              {ARABIC_MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select
              value={selYear} onChange={(e) => setSelYear(Number(e.target.value))}
              className={`w-24 ${selectCls}`}
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </Field>

        <Field label="المبلغ (جنيه)">
          <input
            type="number" min="1" required dir="ltr" autoFocus
            value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="0" className={inputCls}
          />
        </Field>

        <ErrorText>{error}</ErrorText>
        <ModalActions onCancel={onClose} busy={saving} submitLabel="حفظ" />
      </form>
    </Modal>
  );
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

function DeleteEmployeeModal({
  employee,
  salaryCount,
  onClose,
}: {
  employee: Employee;
  salaryCount: number;
  onClose: () => void;
}) {
  const { removeEmployee } = useData();
  const [withSalaries, setWithSalaries] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setError("");
    setDeleting(true);
    try {
      await removeEmployee(employee.id, withSalaries);
      onClose();
    } catch {
      setError("حدث خطأ أثناء الحذف. حاول مرة أخرى.");
      setDeleting(false);
    }
  }

  return (
    <Modal title="تأكيد الحذف" size="sm" onClose={onClose}>
      <p className="text-sm text-gray-700 mb-2">
        هل تريد حذف الموظف <span className="font-semibold text-gray-900">{employee.name}</span>؟
      </p>
      {salaryCount > 0 && (
        <>
          <p className="text-xs text-gray-500 mb-4">
            الموظف هيتشال من القائمة. مرتباته المسجلة ({salaryCount}) هتفضل محسوبة في تقارير الشهور السابقة.
          </p>
          <label className="flex items-start gap-2 text-xs text-gray-700 mb-5 cursor-pointer">
            <input type="checkbox" checked={withSalaries} onChange={(e) => setWithSalaries(e.target.checked)}
              className="mt-0.5" />
            <span>
              احذف سجلات مرتباته كمان من التقارير
              <span className="text-gray-400"> (لو الموظف اتسجل بالغلط)</span>
            </span>
          </label>
        </>
      )}
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      <div className={salaryCount > 0 ? "" : "mt-4"}>
        <ModalActions onCancel={onClose} onSubmit={handleDelete} busy={deleting}
          submitLabel={withSalaries ? "حذف نهائي" : "حذف"} busyLabel="جارٍ الحذف..." color="red" />
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Dialog = { kind: "add" } | { kind: "edit" | "details" | "salary" | "delete"; id: string };

export default function EmployeesPage() {
  const { employees: allEmployees, salaries } = useData();
  const [selected, setSelected] = useState(currentMonth);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  // الموظفين المحذوفين مش بيظهروا في القائمة (مرتباتهم القديمة بس اللي بتفضل في التقارير).
  const employees = useMemo(
    () => allEmployees?.filter((e) => !e.deleted) ?? null,
    [allEmployees]
  );

  const monthOptions = useMemo(() => buildMonthOptions(salaries ?? []), [salaries]);

  // ── المدفوع لكل موظف في الشهر المختار + إجمالي الشهر ───────────────────────
  const { paidByEmployee, totalSalaries } = useMemo(() => {
    const known = new Set((allEmployees ?? []).map((e) => e.id));
    const paid = new Map<string, number>();
    let total = 0;
    for (const s of salaries ?? []) {
      if (s.month !== selected.month || s.year !== selected.year || !known.has(s.employeeId)) continue;
      paid.set(s.employeeId, (paid.get(s.employeeId) ?? 0) + s.amount);
      total += s.amount;
    }
    return { paidByEmployee: paid, totalSalaries: total };
  }, [allEmployees, salaries, selected]);

  const close = () => setDialog(null);
  const dialogEmployee =
    dialog && "id" in dialog ? employees?.find((e) => e.id === dialog.id) ?? null : null;

  return (
    <>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">الموظفين</h2>
            <p className="text-sm text-gray-500 mt-0.5">إدارة الموظفين والمرتبات</p>
          </div>
          <button
            onClick={() => setDialog({ kind: "add" })}
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
            <MonthSelect value={selected} options={monthOptions} onChange={setSelected} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              <div className="bg-blue-100 text-blue-600 rounded-xl p-2 sm:p-3 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="text-center sm:text-right">
                <p className="text-xs sm:text-sm text-gray-500 font-medium">عدد الموظفين</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-700">{employees?.length ?? 0}</p>
              </div>
            </div>

            <div className="bg-red-50 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              <div className="bg-red-100 text-red-600 rounded-xl p-2 sm:p-3 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-center sm:text-right">
                <p className="text-xs sm:text-sm text-gray-500 font-medium">
                  إجمالي المرتبات · {ARABIC_MONTHS[selected.month]}
                </p>
                <p className="text-lg sm:text-2xl font-bold text-red-700">
                  {formatMoney(totalSalaries)} جنيه
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Employee table ───────────────────────────────────────────────── */}
        {!employees || !salaries ? (
          <TableSkeleton rows={4} />
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
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-right">
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">الاسم</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">الوظيفة</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">المرتب المستحق</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">المدفوع</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">المتبقي</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.map((emp) => {
                    const empPaid = paidByEmployee.get(emp.id) ?? 0;
                    const empRemaining = Math.max(0, emp.monthlySalary - empPaid);
                    return (
                      <tr key={emp.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => setDialog({ kind: "details", id: emp.id })}
                            className="font-medium text-[#1976d2] hover:underline text-right"
                          >
                            {emp.name}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[emp.role]}`}>
                            {ROLE_LABELS[emp.role]}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                          {formatMoney(emp.monthlySalary)} ج
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-medium text-green-700">{formatMoney(empPaid)} ج</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {empRemaining === 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                              مكتمل
                            </span>
                          ) : (
                            <span className="font-semibold text-red-600">{formatMoney(empRemaining)} ج</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setDialog({ kind: "salary", id: emp.id })}
                              className="px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition"
                            >
                              تسجيل مرتب
                            </button>
                            <button
                              onClick={() => setDialog({ kind: "edit", id: emp.id })}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition"
                            >
                              تعديل
                            </button>
                            <button
                              onClick={() => setDialog({ kind: "delete", id: emp.id })}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 transition"
                            >
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
              {employees.length} موظف
            </div>
          </div>
        )}
      </main>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {dialog?.kind === "add" && <EmployeeFormModal onClose={close} />}
      {dialog?.kind === "edit" && dialogEmployee && (
        <EmployeeFormModal employee={dialogEmployee} onClose={close} />
      )}
      {dialog?.kind === "details" && dialogEmployee && salaries && (
        <EmployeeDetailsModal employee={dialogEmployee} salaries={salaries} onClose={close} />
      )}
      {dialog?.kind === "salary" && dialogEmployee && (
        <SalaryModal employee={dialogEmployee} onClose={close} />
      )}
      {dialog?.kind === "delete" && dialogEmployee && salaries && (
        <DeleteEmployeeModal
          employee={dialogEmployee}
          salaryCount={salaries.filter((s) => s.employeeId === dialogEmployee.id).length}
          onClose={close}
        />
      )}
    </>
  );
}
