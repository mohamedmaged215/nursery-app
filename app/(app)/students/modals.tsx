"use client";

import { useEffect, useState } from "react";
import { fetchStudentPayments } from "../../lib/db";
import { addDays, todayISO } from "../../lib/dates";
import { useData } from "../../lib/store";
import { SUBSCRIPTION_DAYS, defaultRenewalStart, statusForEndDate } from "../../lib/studentMath";
import { cleanPhone, formatMoney } from "../../lib/text";
import type { Payment, Student } from "../../lib/types";
import { CloseButton, ErrorText, Field, Modal, ModalActions, inputCls } from "../../components/ui";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** العربيات الأساسية. أي عربية جديدة تتكتب لطالب بتظهر في القائمة تلقائيًا. */
export const DEFAULT_BUS_AREAS = ["عربية عم سعيد", "عربية أبو الشيخ", "توكتوك العرب"];

export function typeLabel(s: Pick<Student, "type" | "area">): string {
  if (s.type === "street") return "بدون مواصلات";
  return s.area || "عربية";
}

const SAVE_ERROR = "حدث خطأ أثناء الحفظ. حاول مرة أخرى.";

const toggleCls = (on: boolean) =>
  `flex-1 py-2 rounded-lg text-sm font-medium transition border ${
    on ? "bg-[#1976d2] text-white border-[#1976d2]" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
  }`;

// ─── Transport picker (بدون مواصلات / عربية) ─────────────────────────────────

const NEW_AREA = "__new__";

function TransportPicker({
  isBus,
  area,
  areas,
  onChange,
}: {
  isBus: boolean;
  area: string;
  areas: string[];
  onChange: (isBus: boolean, area: string) => void;
}) {
  const [typing, setTyping] = useState(false);

  return (
    <Field label="نوع الاشتراك">
      <div className="flex gap-2 mb-2">
        <button type="button" onClick={() => onChange(false, area)} className={toggleCls(!isBus)}>
          بدون مواصلات
        </button>
        <button type="button" onClick={() => onChange(true, area || areas[0] || "")} className={toggleCls(isBus)}>
          عربية
        </button>
      </div>
      {isBus && !typing && (
        <select
          value={area}
          onChange={(e) => {
            if (e.target.value === NEW_AREA) {
              setTyping(true);
              onChange(true, "");
            } else {
              onChange(true, e.target.value);
            }
          }}
          className={inputCls}
        >
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          <option value={NEW_AREA}>＋ عربية جديدة...</option>
        </select>
      )}
      {isBus && typing && (
        <div className="flex gap-2">
          <input
            type="text" autoFocus value={area} onChange={(e) => onChange(true, e.target.value)}
            placeholder="اسم العربية الجديدة" className={inputCls}
          />
          <button
            type="button"
            onClick={() => { setTyping(false); onChange(true, areas[0] || ""); }}
            className="px-3 rounded-lg border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-50 transition whitespace-nowrap"
          >
            القائمة
          </button>
        </div>
      )}
    </Field>
  );
}

// ─── Add / Edit Student ───────────────────────────────────────────────────────

export function StudentFormModal({
  student,
  busAreas,
  onClose,
}: {
  student?: Student;
  busAreas: string[];
  onClose: () => void;
}) {
  const { addStudent, editStudent } = useData();
  const isEdit = !!student;

  const [name, setName] = useState(student?.name ?? "");
  const [phone, setPhone] = useState(student?.phone ?? "");
  const [isBus, setIsBus] = useState(student?.type === "bus");
  const [area, setArea] = useState(student?.type === "bus" ? student.area : "");
  const [subscriptionAmount, setSubscriptionAmount] = useState(
    student?.subscriptionAmount ? String(student.subscriptionAmount) : ""
  );
  const [startDate, setStartDate] = useState(student ? student.startDate : todayISO());
  const [previousDebt, setPreviousDebt] = useState(String(student?.previousDebt ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const showDebt = (student?.previousDebt ?? 0) > 0;
  const endDate = addDays(startDate, SUBSCRIPTION_DAYS);
  const dateRequired = !isEdit || !!student?.startDate;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const sub = Number(subscriptionAmount);
    const debt = showDebt ? Number(previousDebt) : 0;
    if (!name.trim() || !phone.trim()) { setError("يرجى ملء جميع الحقول المطلوبة"); return; }
    if (!cleanPhone(phone)) { setError("يرجى إدخال رقم موبايل صحيح"); return; }
    if (isBus && !area.trim()) { setError("يرجى اختيار أو كتابة اسم العربية"); return; }
    if (isNaN(sub) || sub <= 0) { setError("يرجى إدخال مبلغ اشتراك صحيح"); return; }
    if (isNaN(debt) || debt < 0) { setError("يرجى إدخال مديونية صحيحة"); return; }
    if (dateRequired && !endDate) { setError("يرجى تحديد تاريخ بدء الاشتراك"); return; }
    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        phone: cleanPhone(phone),
        type: isBus ? ("bus" as const) : ("street" as const),
        area: isBus ? area.trim() : "",
        subscriptionAmount: sub,
        startDate,
      };
      if (student) await editStudent(student.id, { ...input, previousDebt: debt });
      else await addStudent(input);
      onClose();
    } catch {
      setError(SAVE_ERROR);
      setSaving(false);
    }
  }

  return (
    <Modal title={isEdit ? "تعديل بيانات الطالب" : "إضافة طالب جديد"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="اسم الطفل *">
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
            placeholder="أدخل اسم الطفل" className={inputCls} />
        </Field>

        <Field label="موبايل ولي الأمر *">
          <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="01xxxxxxxxx" dir="ltr" className={inputCls} />
        </Field>

        <TransportPicker
          isBus={isBus} area={area} areas={busAreas}
          onChange={(bus, a) => { setIsBus(bus); setArea(a); }}
        />

        <Field label="مبلغ الاشتراك (جنيه) *">
          <input type="number" min="1" required value={subscriptionAmount}
            onChange={(e) => setSubscriptionAmount(e.target.value)} placeholder="0" dir="ltr" className={inputCls} />
        </Field>

        {showDebt && (
          <Field label="مديونية سابقة مرحّلة (جنيه)">
            <input type="number" min="0" value={previousDebt}
              onChange={(e) => setPreviousDebt(e.target.value)} dir="ltr" className={inputCls} />
            <p className="text-xs text-gray-400 mt-1">الباقي من اشتراكات قديمة. خلّيها 0 لو عايز تتنازل عنها.</p>
          </Field>
        )}

        <Field label="تاريخ بدء الاشتراك">
          <input type="date" required={dateRequired} value={startDate}
            onChange={(e) => setStartDate(e.target.value)} dir="ltr" className={inputCls} />
          {endDate && <p className="text-xs text-gray-400 mt-1">تاريخ الانتهاء: {endDate}</p>}
        </Field>

        <ErrorText>{error}</ErrorText>
        <ModalActions onCancel={onClose} busy={saving} submitLabel={isEdit ? "حفظ التعديلات" : "حفظ"} />
      </form>
    </Modal>
  );
}

// ─── Student Details + payment history ────────────────────────────────────────

export function StudentDetailsModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const { removePayment } = useData();
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchStudentPayments(student.id)
      .then((data) => {
        if (!cancelled) setPayments(data.sort((a, b) => b.date.localeCompare(a.date)));
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => { cancelled = true; };
  }, [student.id]);

  async function handleDeletePayment(payment: Payment) {
    setError("");
    setDeletingId(payment.id);
    try {
      await removePayment(payment);
      setPayments((prev) => prev?.filter((p) => p.id !== payment.id) ?? null);
    } catch {
      setError("حدث خطأ أثناء حذف الدفعة. حاول مرة أخرى.");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  const rows: [string, React.ReactNode][] = [
    ["الموبايل", <span key="v" dir="ltr">{student.phone}</span>],
    ["نوع الاشتراك", typeLabel(student)],
    ["مبلغ الاشتراك", `${formatMoney(student.subscriptionAmount)} ج`],
    ...(student.previousDebt > 0
      ? [["مديونية سابقة", `${formatMoney(student.previousDebt)} ج`] as [string, React.ReactNode]]
      : []),
    ["الإجمالي", `${formatMoney(student.totalAmount)} ج`],
    ["المدفوع", <span key="v" className="text-green-700">{formatMoney(student.paidAmount)} ج</span>],
    ["الباقي", (
      <span key="v" className={student.remainingAmount > 0 ? "text-orange-600" : "text-green-600"}>
        {formatMoney(student.remainingAmount)} ج
      </span>
    )],
    ["بداية الاشتراك", student.startDate || "—"],
    ["نهاية الاشتراك", student.endDate || "—"],
    ["الحالة", (
      <span key="v" className={student.status === "active" ? "text-green-700" : "text-red-600"}>
        {student.status === "active" ? "نشط" : "منتهي"}
      </span>
    )],
  ];

  return (
    <Modal title="تفاصيل الطالب" onClose={onClose}>
      <div className="bg-gray-50 rounded-xl px-4 py-4 mb-5 space-y-2">
        <p className="text-base font-bold text-gray-900">{student.name}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium text-gray-700">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <h3 className="text-sm font-bold text-gray-700 mb-3">سجل الدفعات</h3>
      {loadFailed ? (
        <p className="text-sm text-red-600 text-center py-4">تعذّر تحميل الدفعات. تأكد من الإنترنت وافتح النافذة تاني.</p>
      ) : payments === null ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : payments.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">لا توجد دفعات مسجلة</p>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 font-semibold text-gray-600 text-right">التاريخ</th>
                <th className="px-3 py-2 font-semibold text-gray-600 text-right">المبلغ</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 text-gray-600">{p.date}</td>
                  <td className="px-3 py-2 font-semibold text-green-700">{formatMoney(p.amount)} ج</td>
                  <td className="px-3 py-2 text-left whitespace-nowrap">
                    {confirmId === p.id ? (
                      <>
                        <button onClick={() => handleDeletePayment(p)} disabled={deletingId === p.id}
                          className="text-red-600 font-bold hover:underline disabled:opacity-60">
                          {deletingId === p.id ? "..." : "تأكيد الحذف"}
                        </button>
                        <button onClick={() => setConfirmId(null)} className="text-gray-500 hover:underline mr-3">
                          إلغاء
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmId(p.id)} className="text-red-500 hover:underline">
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
      {payments && payments.length > 0 && (
        <p className="text-xs text-gray-400 mt-2">حذف دفعة اتسجلت غلط بيرجّع مبلغها على الباقي على الطالب.</p>
      )}
      {error && <div className="mt-3"><ErrorText>{error}</ErrorText></div>}

      <CloseButton onClose={onClose} />
    </Modal>
  );
}

// ─── Payment ──────────────────────────────────────────────────────────────────

export function PaymentModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const { payStudent } = useData();
  const [amount, setAmount] = useState(String(student.remainingAmount));
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) { setError("يرجى إدخال مبلغ صحيح"); return; }
    if (amt > student.remainingAmount) {
      setError(`المبلغ أكبر من الباقي على الطالب (${formatMoney(student.remainingAmount)} جنيه)`);
      return;
    }
    if (!addDays(date, 0)) { setError("يرجى تحديد تاريخ الدفع"); return; }
    setSaving(true);
    try {
      await payStudent(student.id, amt, date);
      onClose();
    } catch {
      setError("حدث خطأ أثناء التسجيل. حاول مرة أخرى.");
      setSaving(false);
    }
  }

  return (
    <Modal title="تسجيل دفعة" size="sm" onClose={onClose}>
      <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 space-y-1.5">
        <p className="text-sm font-semibold text-gray-900">{student.name}</p>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">الإجمالي</span>
          <span className="font-medium text-gray-700">{formatMoney(student.totalAmount)} جنيه</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">المدفوع</span>
          <span className="font-medium text-green-700">{formatMoney(student.paidAmount)} جنيه</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">الباقي</span>
          <span className="font-medium text-orange-600">{formatMoney(student.remainingAmount)} جنيه</span>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="المبلغ المدفوع (جنيه)">
          <input type="number" min="1" required value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="0" dir="ltr" autoFocus className={inputCls} />
        </Field>
        <Field label="تاريخ الدفع">
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)}
            dir="ltr" className={inputCls} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <ModalActions onCancel={onClose} busy={saving} submitLabel="تأكيد الدفع" color="green" />
      </form>
    </Modal>
  );
}

// ─── Renewal ──────────────────────────────────────────────────────────────────

export function RenewalModal({
  student,
  busAreas,
  onClose,
}: {
  student: Student;
  busAreas: string[];
  onClose: () => void;
}) {
  const { renewStudent } = useData();
  const today = todayISO();
  const [subAmount, setSubAmount] = useState(String(student.subscriptionAmount || ""));
  const [isBus, setIsBus] = useState(student.type === "bus");
  const [area, setArea] = useState(student.type === "bus" ? student.area : "");
  const [startDate, setStartDate] = useState(() => defaultRenewalStart(student, today));
  const [carryDebt, setCarryDebt] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sub = Number(subAmount) || 0;
  const oldDebt = student.remainingAmount;
  const carried = carryDebt ? oldDebt : 0;
  const endDate = addDays(startDate, SUBSCRIPTION_DAYS);
  const alreadyExpired = !!endDate && statusForEndDate(endDate, today) === "inactive";
  // "من نهاية الاشتراك السابق" بيظهر بس لو الاشتراك الجديد مش هيطلع منتهي أصلًا.
  const canContinue =
    !!student.endDate && statusForEndDate(addDays(student.endDate, SUBSCRIPTION_DAYS), today) === "active";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (sub <= 0) { setError("يرجى إدخال مبلغ اشتراك صحيح"); return; }
    if (isBus && !area.trim()) { setError("يرجى اختيار أو كتابة اسم العربية"); return; }
    if (!endDate) { setError("يرجى تحديد تاريخ بداية الاشتراك الجديد"); return; }
    if (alreadyExpired) { setError("تاريخ البداية ده قديم: الاشتراك الجديد هيبقى منتهي. اختار تاريخ أحدث."); return; }
    setSaving(true);
    try {
      await renewStudent(student.id, {
        subscriptionAmount: sub,
        type: isBus ? "bus" : "street",
        area: isBus ? area.trim() : "",
        startDate,
        carryDebt,
      });
      onClose();
    } catch {
      setError(SAVE_ERROR);
      setSaving(false);
    }
  }

  const quickCls = (on: boolean) =>
    `px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
      on ? "bg-blue-50 text-blue-700 border-blue-300" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
    }`;

  return (
    <Modal title="تجديد اشتراك" size="sm" onClose={onClose}>
      <div className="bg-blue-50 rounded-xl px-4 py-3 mb-5">
        <p className="text-sm font-semibold text-gray-900">{student.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {typeLabel(student)}
          {student.endDate ? ` · ${student.endDate > today ? "ينتهي" : "انتهى"}: ${student.endDate}` : ""}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <TransportPicker
          isBus={isBus} area={area} areas={busAreas}
          onChange={(bus, a) => { setIsBus(bus); setArea(a); }}
        />

        <Field label="مبلغ الاشتراك الجديد (جنيه) *">
          <input type="number" min="1" required dir="ltr" autoFocus
            value={subAmount} onChange={(e) => setSubAmount(e.target.value)}
            placeholder="0" className={inputCls} />
        </Field>

        <Field label="بداية الاشتراك الجديد">
          <input type="date" required dir="ltr" value={startDate}
            onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          <div className="flex flex-wrap gap-2 mt-2">
            {canContinue && student.endDate !== today && (
              <button type="button" onClick={() => setStartDate(student.endDate)}
                className={quickCls(startDate === student.endDate)}>
                من نهاية الاشتراك السابق
              </button>
            )}
            <button type="button" onClick={() => setStartDate(today)} className={quickCls(startDate === today)}>
              من النهارده
            </button>
          </div>
        </Field>

        {oldDebt > 0 && (
          <label className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3.5 py-3 text-sm text-orange-900 cursor-pointer">
            <input type="checkbox" checked={carryDebt} onChange={(e) => setCarryDebt(e.target.checked)}
              className="mt-1" />
            <span>
              باقي عليه <span className="font-bold">{formatMoney(oldDebt)} جنيه</span> من الاشتراك السابق.
              <br />
              <span className="text-xs">ترحيل المبلغ ده على الاشتراك الجديد (شيل العلامة لو هتتنازل عنه).</span>
            </span>
          </label>
        )}

        {sub > 0 && endDate && (
          <div className="bg-green-50 rounded-xl px-4 py-3 text-sm text-green-900">
            الإجمالي الجديد: <span className="font-bold">{formatMoney(sub + carried)} جنيه</span>
            {carried > 0 && (
              <span className="text-xs"> ({formatMoney(sub)} اشتراك + {formatMoney(carried)} مديونية سابقة)</span>
            )}
            <p className="text-xs text-green-700 mt-0.5">
              من {startDate} إلى {endDate} ({SUBSCRIPTION_DAYS} يوم)
            </p>
          </div>
        )}

        <ErrorText>{error}</ErrorText>
        <ModalActions onCancel={onClose} busy={saving} submitLabel="تجديد وتفعيل" />
      </form>
    </Modal>
  );
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function DeleteStudentModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const { removeStudent } = useData();
  const [withPayments, setWithPayments] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setError("");
    setDeleting(true);
    try {
      await removeStudent(student.id, withPayments);
      onClose();
    } catch {
      setError("حدث خطأ أثناء الحذف. حاول مرة أخرى.");
      setDeleting(false);
    }
  }

  return (
    <Modal title="حذف الطالب" size="sm" onClose={onClose}>
      <p className="text-sm text-gray-700 mb-2">
        هل تريد حذف الطالب <span className="font-semibold text-gray-900">{student.name}</span>؟
      </p>
      <p className="text-xs text-gray-500 mb-4">
        الطالب هيتشال من القائمة. دفعاته السابقة هتفضل محسوبة في إيرادات الشهور اللي اتدفعت فيها.
      </p>
      <label className="flex items-start gap-2 text-xs text-gray-700 mb-5 cursor-pointer">
        <input type="checkbox" checked={withPayments} onChange={(e) => setWithPayments(e.target.checked)}
          className="mt-0.5" />
        <span>
          احذف كل دفعاته كمان من التقارير
          <span className="text-gray-400"> (لو الطالب اتسجل بالغلط)</span>
        </span>
      </label>
      {withPayments && (
        <p className="text-xs text-red-600 mb-4">سيتم حذف الطالب وجميع دفعاته نهائياً ولا يمكن التراجع.</p>
      )}
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      <ModalActions onCancel={onClose} onSubmit={handleDelete} busy={deleting}
        submitLabel={withPayments ? "حذف نهائي" : "حذف"} busyLabel="جارٍ الحذف..." color="red" />
    </Modal>
  );
}

// ─── Bus group ────────────────────────────────────────────────────────────────

export function BusGroupModal({
  area,
  students,
  onClose,
}: {
  area: string;
  students: Student[];
  onClose: () => void;
}) {
  const areaStudents = students.filter(
    (s) => s.type === "bus" && s.area === area && s.status === "active"
  );
  const totalSub  = areaStudents.reduce((sum, s) => sum + s.subscriptionAmount, 0);
  const totalPaid = areaStudents.reduce((sum, s) => sum + s.paidAmount, 0);
  const totalRem  = areaStudents.reduce((sum, s) => sum + s.remainingAmount, 0);

  return (
    <Modal title={area} subtitle={`${areaStudents.length} طالب نشط`} size="lg" onClose={onClose}>
      {areaStudents.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">لا يوجد طلاب نشطين في هذه العربية</p>
      ) : (
        <>
          <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-right">
                  <th className="px-3 py-2 font-semibold text-gray-600 text-xs">الاسم</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 text-xs">الاشتراك</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 text-xs">المدفوع</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 text-xs">الباقي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {areaStudents.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 font-medium text-gray-800 text-xs">{s.name}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs">{formatMoney(s.subscriptionAmount)} ج</td>
                    <td className="px-3 py-2 text-green-700 font-medium text-xs">{formatMoney(s.paidAmount)} ج</td>
                    <td className={`px-3 py-2 font-medium text-xs ${s.remainingAmount > 0 ? "text-orange-600" : "text-green-600"}`}>
                      {formatMoney(s.remainingAmount)} ج
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl px-3 py-3 text-center">
              <p className="text-xs text-gray-500 mb-1">إجمالي الاشتراكات</p>
              <p className="text-sm font-bold text-gray-900">{formatMoney(totalSub)} ج</p>
            </div>
            <div className="bg-green-50 rounded-xl px-3 py-3 text-center">
              <p className="text-xs text-gray-500 mb-1">إجمالي المدفوع</p>
              <p className="text-sm font-bold text-green-700">{formatMoney(totalPaid)} ج</p>
            </div>
            <div className="bg-orange-50 rounded-xl px-3 py-3 text-center">
              <p className="text-xs text-gray-500 mb-1">إجمالي الباقي</p>
              <p className="text-sm font-bold text-orange-600">{formatMoney(totalRem)} ج</p>
            </div>
          </div>
        </>
      )}
      <CloseButton onClose={onClose} />
    </Modal>
  );
}
