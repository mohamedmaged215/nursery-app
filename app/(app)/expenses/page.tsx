"use client";

import { useMemo, useState } from "react";
import { ARABIC_MONTHS, buildMonthOptions, currentMonth, monthLabel, monthOfDate, todayISO } from "../../lib/dates";
import { useData } from "../../lib/store";
import { formatMoney } from "../../lib/text";
import type { Expense, ExpenseType } from "../../lib/types";
import { ErrorText, Field, Modal, ModalActions, MonthSelect, TableSkeleton, inputCls } from "../../components/ui";

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  supplies: "هوالك",
  rent:     "إيجار",
};

const TYPE_BADGE: Record<string, string> = {
  supplies: "bg-gray-100   text-gray-600",
  rent:     "bg-orange-100 text-orange-700",
};

// ─── Add / Edit Expense Modal ─────────────────────────────────────────────────

function ExpenseFormModal({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
  const { saveExpense } = useData();
  const isEdit = !!expense;

  const [name,   setName]   = useState(expense?.name ?? "");
  const [amount, setAmount] = useState(expense?.amount ? String(expense.amount) : "");
  const [date,   setDate]   = useState(expense?.date || todayISO());
  const [type,   setType]   = useState<ExpenseType>(expense?.type === "rent" ? "rent" : "supplies");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const amt = Number(amount);
    if (!name.trim())           { setError("يرجى إدخال البيان"); return; }
    if (isNaN(amt) || amt <= 0) { setError("يرجى إدخال مبلغ صحيح"); return; }
    if (!monthOfDate(date))     { setError("يرجى تحديد التاريخ"); return; }

    setSaving(true);
    try {
      await saveExpense({ name: name.trim(), amount: amt, date, type }, expense?.id);
      onClose();
    } catch {
      setError("حدث خطأ أثناء الحفظ. حاول مرة أخرى.");
      setSaving(false);
    }
  }

  return (
    <Modal title={isEdit ? "تعديل المصروف" : "إضافة مصروف"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="النوع *">
          <div className="flex gap-2">
            {(["supplies", "rent"] as const).map((t) => (
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
        </Field>

        <Field label="البيان *">
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
            placeholder="اسم المصروف" className={inputCls} />
        </Field>

        <Field label="المبلغ (جنيه) *">
          <input type="number" min="1" required dir="ltr"
            value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="0" className={inputCls} />
        </Field>

        <Field label="التاريخ *">
          <input type="date" required dir="ltr"
            value={date} onChange={(e) => setDate(e.target.value)}
            className={inputCls} />
        </Field>

        <ErrorText>{error}</ErrorText>
        <ModalActions onCancel={onClose} busy={saving} submitLabel={isEdit ? "حفظ التعديلات" : "إضافة"} />
      </form>
    </Modal>
  );
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

function DeleteExpenseModal({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const { removeExpense } = useData();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setError("");
    setDeleting(true);
    try {
      await removeExpense(expense.id);
      onClose();
    } catch {
      setError("حدث خطأ أثناء الحذف. حاول مرة أخرى.");
      setDeleting(false);
    }
  }

  return (
    <Modal title="تأكيد الحذف" size="sm" onClose={onClose}>
      <p className="text-sm text-gray-500 mb-6">
        هل تريد حذف المصروف{" "}
        <span className="font-semibold text-gray-900">&quot;{expense.name}&quot;</span>؟
      </p>
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      <ModalActions onCancel={onClose} onSubmit={handleDelete} busy={deleting}
        submitLabel="حذف" busyLabel="جارٍ الحذف..." color="red" />
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Dialog = { kind: "add" } | { kind: "edit" | "delete"; id: string };

export default function ExpensesPage() {
  const { expenses } = useData();
  const [selected, setSelected] = useState(currentMonth);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const monthOptions = useMemo(() => buildMonthOptions(expenses ?? []), [expenses]);

  const filtered = useMemo(
    () =>
      (expenses ?? [])
        .filter((e) => e.month === selected.month && e.year === selected.year)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, selected]
  );

  const total = filtered.reduce((sum, e) => sum + e.amount, 0);

  const close = () => setDialog(null);
  const dialogExpense =
    dialog && "id" in dialog ? expenses?.find((e) => e.id === dialog.id) ?? null : null;

  return (
    <>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">المصاريف</h2>
            <p className="text-sm text-gray-500 mt-0.5">تتبع وإدارة مصاريف الحضانة</p>
          </div>
          <button
            onClick={() => setDialog({ kind: "add" })}
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
            <MonthSelect value={selected} options={monthOptions} onChange={setSelected} />
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
                <p className="text-lg sm:text-2xl font-bold text-orange-700">{filtered.length}</p>
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
                  إجمالي المصاريف · {ARABIC_MONTHS[selected.month]}
                </p>
                <p className="text-lg sm:text-2xl font-bold text-red-700">
                  {formatMoney(total)} جنيه
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Expenses table ───────────────────────────────────────────────── */}
        {!expenses ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-200">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-sm font-medium">لا توجد مصاريف في {monthLabel(selected)}</p>
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
                  {filtered.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{expense.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[expense.type] ?? "bg-gray-100 text-gray-600"}`}>
                          {TYPE_LABELS[expense.type] ?? "أخرى"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-red-700 whitespace-nowrap">
                        {formatMoney(expense.amount)} جنيه
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap" dir="ltr">{expense.date}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setDialog({ kind: "edit", id: expense.id })}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition">
                            تعديل
                          </button>
                          <button onClick={() => setDialog({ kind: "delete", id: expense.id })}
                            className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 transition">
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
              <span className="font-semibold text-red-700">الإجمالي: {formatMoney(total)} جنيه</span>
            </div>
          </div>
        )}
      </main>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {dialog?.kind === "add" && <ExpenseFormModal onClose={close} />}
      {dialog?.kind === "edit" && dialogExpense && (
        <ExpenseFormModal expense={dialogExpense} onClose={close} />
      )}
      {dialog?.kind === "delete" && dialogExpense && (
        <DeleteExpenseModal expense={dialogExpense} onClose={close} />
      )}
    </>
  );
}
