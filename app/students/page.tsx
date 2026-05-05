"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import Navbar from "../components/Navbar";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  name: string;
  phone: string;
  type: "street" | "bus";
  area: string;
  subscriptionAmount: number;
  busAmount: number;       // kept in Firestore for legacy; not used in calculations
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: "active" | "inactive";
  startDate: string;
  endDate: string;
  createdAt: string;
}

interface Payment {
  id: string;
  studentId: string;
  amount: number;
  date: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: "street", label: "بدون مواصلات" },
  { value: "bus",    label: "عربية عم سعيد" },
  { value: "bus2",   label: "عربية أبو الشيخ" },
  { value: "bus3",   label: "توكتوك العرب" },
] as const;

// Display label for a student's transport type
function typeLabel(s: Student): string {
  if (s.type === "street") return "بدون مواصلات";
  if (s.area === "عربية عم سعيد")   return "عربية عم سعيد";
  if (s.area === "عربية أبو الشيخ") return "عربية أبو الشيخ";
  if (s.area === "توكتوك العرب")    return "توكتوك العرب";
  return s.area || "عربية";
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Firestore helpers ────────────────────────────────────────────────────────

async function fetchStudents(): Promise<Student[]> {
  const snap = await getDocs(collection(db, "students"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student));
}

async function createStudent(data: Omit<Student, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "students"), data);
  return ref.id;
}

async function saveEditStudent(id: string, patch: Partial<Omit<Student, "id">>): Promise<void> {
  await updateDoc(doc(db, "students", id), patch);
}

async function renewStudent(
  id: string,
  subscriptionAmount: number,
  type: "street" | "bus",
  area: string,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await updateDoc(doc(db, "students", id), {
    status: "active",
    subscriptionAmount,
    busAmount: 0,
    totalAmount: subscriptionAmount,
    paidAmount: 0,
    remainingAmount: subscriptionAmount,
    type,
    area,
    startDate: today,
    endDate: addDays(today, 30),
  });
}

async function registerPayment(
  studentId: string,
  amount: number,
  newPaid: number,
  newRemaining: number
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await addDoc(collection(db, "payments"), { studentId, amount, date: today });
  await updateDoc(doc(db, "students", studentId), {
    paidAmount: newPaid,
    remainingAmount: newRemaining,
  });
}

async function deleteStudentWithPayments(studentId: string): Promise<void> {
  const paymentsSnap = await getDocs(query(collection(db, "payments"), where("studentId", "==", studentId)));
  await Promise.all([
    deleteDoc(doc(db, "students", studentId)),
    ...paymentsSnap.docs.map((d) => deleteDoc(d.ref)),
  ]);
}

async function checkAndExpireStudents(students: Student[]): Promise<Student[]> {
  const today = new Date().toISOString().slice(0, 10);
  const toExpire = students.filter(
    (s) => s.status === "active" && s.endDate && s.endDate <= today
  );
  if (toExpire.length === 0) return students;
  await Promise.all(
    toExpire.map((s) => updateDoc(doc(db, "students", s.id), { status: "inactive" }))
  );
  const expiredIds = new Set(toExpire.map((s) => s.id));
  return students.map((s) =>
    expiredIds.has(s.id) ? { ...s, status: "inactive" as const } : s
  );
}

// ─── Shared input class ───────────────────────────────────────────────────────

const inputCls =
  "w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";

// ─── Add / Edit Student Modal ─────────────────────────────────────────────────

function AddEditStudentModal({
  student,
  onClose,
  onSaved,
}: {
  student?: Student;
  onClose: () => void;
  onSaved: (student: Student) => void;
}) {
  const isEdit = !!student;
  const todayStr = new Date().toISOString().slice(0, 10);

  // Determine initial transport value from existing student
  const initialTransport = (() => {
    if (!student) return "street";
    if (student.type === "street") return "street";
    return student.area || "عربية عم سعيد";
  })();

  const [name, setName] = useState(student?.name ?? "");
  const [phone, setPhone] = useState(student?.phone ?? "");
  const [transport, setTransport] = useState<string>(initialTransport);
  const [subscriptionAmount, setSubscriptionAmount] = useState(
    student?.subscriptionAmount ? String(student.subscriptionAmount) : ""
  );
  const [startDate, setStartDate] = useState(student?.startDate ?? todayStr);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isBus = transport !== "street";
  const effectiveType: "street" | "bus" = isBus ? "bus" : "street";
  const effectiveArea = isBus ? transport : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const sub = Number(subscriptionAmount);
    if (!name.trim() || !phone.trim()) { setError("يرجى ملء جميع الحقول المطلوبة"); return; }
    if (isNaN(sub) || sub <= 0) { setError("يرجى إدخال مبلغ اشتراك صحيح"); return; }
    setSaving(true);
    try {
      if (isEdit && student) {
        const remaining = Math.max(0, sub - student.paidAmount);
        const patch = {
          name: name.trim(),
          phone: phone.trim(),
          type: effectiveType,
          area: effectiveArea,
          subscriptionAmount: sub,
          busAmount: 0,
          totalAmount: sub,
          remainingAmount: remaining,
        };
        await saveEditStudent(student.id, patch);
        onSaved({ ...student, ...patch });
      } else {
        const data: Omit<Student, "id"> = {
          name: name.trim(),
          phone: phone.trim(),
          type: effectiveType,
          area: effectiveArea,
          subscriptionAmount: sub,
          busAmount: 0,
          totalAmount: sub,
          paidAmount: 0,
          remainingAmount: sub,
          status: "active",
          startDate,
          endDate: addDays(startDate, 30),
          createdAt: todayStr,
        };
        const id = await createStudent(data);
        onSaved({ id, ...data });
      }
      onClose();
    } catch {
      setError("حدث خطأ أثناء الحفظ. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? "تعديل بيانات الطالب" : "إضافة طالب جديد"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">اسم الطفل *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="أدخل اسم الطفل" className={inputCls} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">موبايل ولي الأمر *</label>
            <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="01xxxxxxxxx" dir="ltr" className={inputCls} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">نوع الاشتراك</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setTransport(opt.value)}
                  className={`py-2 rounded-lg text-sm font-medium transition border ${
                    transport === opt.value
                      ? "bg-[#1976d2] text-white border-[#1976d2]"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">مبلغ الاشتراك (جنيه) *</label>
            <input type="number" min="1" required value={subscriptionAmount}
              onChange={(e) => setSubscriptionAmount(e.target.value)} placeholder="0" dir="ltr" className={inputCls} />
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">تاريخ بدء الاشتراك</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                dir="ltr" className={inputCls} />
              <p className="text-xs text-gray-400 mt-1">تاريخ الانتهاء: {addDays(startDate, 30)}</p>
            </div>
          )}

          {subscriptionAmount && (
            <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-900">
              <span>الإجمالي: <span className="font-bold">{(Number(subscriptionAmount) || 0).toLocaleString()} جنيه</span></span>
              {!isEdit && (
                <p className="text-xs text-blue-600 mt-1">ينتهي الاشتراك في {addDays(startDate, 30)}</p>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
              إلغاء
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-[#1976d2] text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition">
              {saving ? "جارٍ الحفظ..." : isEdit ? "حفظ التعديلات" : "حفظ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Student Details Modal ────────────────────────────────────────────────────

function StudentDetailsModal({
  student,
  onClose,
}: {
  student: Student;
  onClose: () => void;
}) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingP, setLoadingP] = useState(true);

  useEffect(() => {
    getDocs(query(collection(db, "payments"), where("studentId", "==", student.id))).then((snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Payment))
        .sort((a, b) => (b.date > a.date ? 1 : -1));
      setPayments(data);
      setLoadingP(false);
    });
  }, [student.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 my-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">تفاصيل الطالب</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="bg-gray-50 rounded-xl px-4 py-4 mb-5 space-y-2">
          <p className="text-base font-bold text-gray-900">{student.name}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <span className="text-gray-500">الموبايل</span>
            <span className="font-medium text-gray-700" dir="ltr">{student.phone}</span>
            <span className="text-gray-500">نوع الاشتراك</span>
            <span className="font-medium text-gray-700">{typeLabel(student)}</span>
            <span className="text-gray-500">مبلغ الاشتراك</span>
            <span className="font-medium text-gray-700">{student.subscriptionAmount.toLocaleString()} ج</span>
            <span className="text-gray-500">الإجمالي</span>
            <span className="font-medium text-gray-700">{student.totalAmount.toLocaleString()} ج</span>
            <span className="text-gray-500">المدفوع</span>
            <span className="font-medium text-green-700">{student.paidAmount.toLocaleString()} ج</span>
            <span className="text-gray-500">الباقي</span>
            <span className={`font-medium ${student.remainingAmount > 0 ? "text-orange-600" : "text-green-600"}`}>
              {student.remainingAmount.toLocaleString()} ج
            </span>
            <span className="text-gray-500">بداية الاشتراك</span>
            <span className="font-medium text-gray-700">{student.startDate || "—"}</span>
            <span className="text-gray-500">نهاية الاشتراك</span>
            <span className="font-medium text-gray-700">{student.endDate || "—"}</span>
            <span className="text-gray-500">الحالة</span>
            <span className={`font-medium ${student.status === "active" ? "text-green-700" : "text-red-600"}`}>
              {student.status === "active" ? "نشط" : "منتهي"}
            </span>
          </div>
        </div>

        <h3 className="text-sm font-bold text-gray-700 mb-3">سجل الدفعات</h3>
        {loadingP ? (
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 text-gray-600">{p.date}</td>
                    <td className="px-3 py-2 font-semibold text-green-700">{p.amount.toLocaleString()} ج</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
          إغلاق
        </button>
      </div>
    </div>
  );
}

// ─── Payment Modal ────────────────────────────────────────────────────────────

function PaymentModal({
  student,
  onClose,
  onPaid,
}: {
  student: Student;
  onClose: () => void;
  onPaid: (studentId: string, newPaid: number, newRemaining: number) => void;
}) {
  const [amount, setAmount] = useState(
    student.remainingAmount > 0 ? String(student.remainingAmount) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) { setError("يرجى إدخال مبلغ صحيح"); return; }
    setSaving(true);
    try {
      const newPaid = student.paidAmount + amt;
      const newRemaining = Math.max(0, student.totalAmount - newPaid);
      await registerPayment(student.id, amt, newPaid, newRemaining);
      onPaid(student.id, newPaid, newRemaining);
      onClose();
    } catch {
      setError("حدث خطأ أثناء التسجيل. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">تسجيل دفعة</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 space-y-1.5">
          <p className="text-sm font-semibold text-gray-900">{student.name}</p>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">الإجمالي</span>
            <span className="font-medium text-gray-700">{student.totalAmount.toLocaleString()} جنيه</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">المدفوع</span>
            <span className="font-medium text-green-700">{student.paidAmount.toLocaleString()} جنيه</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">الباقي</span>
            <span className="font-medium text-orange-600">{student.remainingAmount.toLocaleString()} جنيه</span>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">المبلغ المدفوع (جنيه)</label>
            <input type="number" min="1" required value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0" dir="ltr" autoFocus className={inputCls} />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">{error}</p>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
              إلغاء
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition">
              {saving ? "جارٍ الحفظ..." : "تأكيد الدفع"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Renewal Modal ────────────────────────────────────────────────────────────

function RenewalModal({
  student,
  onClose,
  onRenewed,
}: {
  student: Student;
  onClose: () => void;
  onRenewed: (id: string, sub: number, type: "street" | "bus", area: string) => void;
}) {
  const initialTransport = student.type === "street" ? "street" : (student.area || "عربية عم سعيد");
  const [subAmount, setSubAmount] = useState(String(student.subscriptionAmount || ""));
  const [transport, setTransport] = useState<string>(initialTransport);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const sub = Number(subAmount) || 0;
  const effectiveType: "street" | "bus" = transport === "street" ? "street" : "bus";
  const effectiveArea = transport === "street" ? "" : transport;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (sub <= 0) { setError("يرجى إدخال مبلغ اشتراك صحيح"); return; }
    setSaving(true);
    try {
      await renewStudent(student.id, sub, effectiveType, effectiveArea);
      onRenewed(student.id, sub, effectiveType, effectiveArea);
      onClose();
    } catch {
      setError("حدث خطأ أثناء الحفظ. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 my-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">تجديد اشتراك</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="bg-blue-50 rounded-xl px-4 py-3 mb-5">
          <p className="text-sm font-semibold text-gray-900">{student.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {typeLabel(student)}
            {student.endDate ? ` · انتهى: ${student.endDate}` : ""}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">نوع الاشتراك</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setTransport(opt.value)}
                  className={`py-2 rounded-lg text-sm font-medium transition border ${
                    transport === opt.value
                      ? "bg-[#1976d2] text-white border-[#1976d2]"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">مبلغ الاشتراك الجديد (جنيه) *</label>
            <input type="number" min="1" required dir="ltr" autoFocus
              value={subAmount} onChange={(e) => setSubAmount(e.target.value)}
              placeholder="0" className={inputCls} />
          </div>
          {sub > 0 && (
            <div className="bg-green-50 rounded-xl px-4 py-3 text-sm text-green-900">
              الإجمالي الجديد: <span className="font-bold">{sub.toLocaleString()} جنيه</span>
              <p className="text-xs text-green-700 mt-0.5">
                سيتم تفعيل الاشتراك لمدة 30 يوم · ينتهي {addDays(new Date().toISOString().slice(0, 10), 30)}
              </p>
            </div>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">{error}</p>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
              إلغاء
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-[#1976d2] text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition">
              {saving ? "جارٍ الحفظ..." : "تجديد وتفعيل"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  student,
  onClose,
  onDeleted,
}: {
  student: Student;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteStudentWithPayments(student.id);
      onDeleted(student.id);
      onClose();
    } catch {
      setError("حدث خطأ أثناء الحذف. حاول مرة أخرى.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">حذف الطالب</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-gray-700 mb-1">
          هل تريد حذف الطالب <span className="font-semibold text-gray-900">{student.name}</span>؟
        </p>
        <p className="text-xs text-red-600 mb-5">سيتم حذف الطالب وجميع دفعاته نهائياً ولا يمكن التراجع.</p>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 mb-4">{error}</p>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
            إلغاء
          </button>
          <button type="button" onClick={handleDelete} disabled={deleting}
            className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition">
            {deleting ? "جارٍ الحذف..." : "حذف نهائي"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudentsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked]         = useState(false);
  const [students, setStudents]               = useState<Student[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [tab, setTab]                         = useState<"active" | "inactive">("active");
  const [search, setSearch]                   = useState("");
  const [showAddModal, setShowAddModal]       = useState(false);
  const [editingStudent, setEditingStudent]   = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent]   = useState<Student | null>(null);
  const [payingStudent, setPayingStudent]     = useState<Student | null>(null);
  const [renewingStudent, setRenewingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) router.replace("/");
      else setAuthChecked(true);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!authChecked) return;
    fetchStudents().then(async (data) => {
      const updated = await checkAndExpireStudents(data);
      setStudents(updated);
      setLoading(false);
    });
  }, [authChecked]);

  const filtered = useMemo(
    () =>
      students
        .filter((s) => s.status === tab)
        .filter((s) =>
          !search.trim() ||
          s.name.includes(search) ||
          s.phone.includes(search)
        ),
    [students, tab, search]
  );

  const activeCount   = students.filter((s) => s.status === "active").length;
  const inactiveCount = students.filter((s) => s.status === "inactive").length;

  function handleStudentSaved(student: Student) {
    setStudents((prev) => {
      const idx = prev.findIndex((s) => s.id === student.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = student; return next; }
      return [student, ...prev];
    });
  }

  function handlePaymentMade(studentId: string, newPaid: number, newRemaining: number) {
    setStudents((prev) =>
      prev.map((s) => s.id === studentId ? { ...s, paidAmount: newPaid, remainingAmount: newRemaining } : s)
    );
  }

  function handleDeleted(id: string) {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  }

  function handleRenewed(id: string, sub: number, type: "street" | "bus", area: string) {
    const today = new Date().toISOString().slice(0, 10);
    setStudents((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: "active", type, area, subscriptionAmount: sub, busAmount: 0,
              totalAmount: sub, paidAmount: 0, remainingAmount: sub,
              startDate: today, endDate: addDays(today, 30) }
          : s
      )
    );
  }

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">الطلاب</h2>
            <p className="text-sm text-gray-500 mt-0.5">إدارة بيانات الطلاب والمدفوعات</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
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
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="bg-gray-100 rounded-xl h-14 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <svg className="w-14 h-14 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm font-medium">
              {search ? "لا توجد نتائج للبحث" : tab === "inactive" ? "لا توجد اشتراكات منتهية" : "لا يوجد طلاب نشطين"}
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
                    const waMsg = `السلام عليكم مع حضرتك إدارة الحضانة\nبنفكر حضرتك إن اشتراك الطفل ${student.name} انتهى\nبرجاء تجديد الاشتراك\nمع تحيات إدارة Mr Kids`;
                    const waUrl = `https://wa.me/2${student.phone}?text=${encodeURIComponent(waMsg)}`;
                    const today = new Date().toISOString().slice(0, 10);
                    const expiringSoon = student.endDate && student.endDate > today &&
                      student.endDate <= addDays(today, 5);
                    return (
                      <tr key={student.id} className={`hover:bg-gray-50 transition ${student.status === "inactive" ? "opacity-75" : ""}`}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button onClick={() => setViewingStudent(student)}
                            className="font-medium text-[#1976d2] hover:underline text-right">
                            {student.name}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap" dir="ltr">{student.phone}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            student.type === "bus" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                          }`}>
                            {typeLabel(student)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                          {student.subscriptionAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-medium text-green-700">{student.paidAmount.toLocaleString()}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`font-medium ${student.remainingAmount > 0 ? "text-orange-600" : "text-green-600"}`}>
                            {student.remainingAmount.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          {student.endDate ? (
                            <span className={tab === "active" && expiringSoon ? "text-red-600 font-semibold" : "text-gray-500"}>
                              {student.endDate}{tab === "active" && expiringSoon && " ⚠"}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {student.status === "active" ? (
                              <button onClick={() => setPayingStudent(student)}
                                className="px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition">
                                دفع
                              </button>
                            ) : (
                              <>
                                <button onClick={() => setRenewingStudent(student)}
                                  className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition">
                                  تجديد
                                </button>
                                <a href={waUrl} target="_blank" rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition">
                                  واتساب
                                </a>
                              </>
                            )}
                            <button onClick={() => setEditingStudent(student)}
                              className="px-2.5 py-1.5 rounded-lg bg-yellow-50 text-yellow-700 text-xs font-semibold hover:bg-yellow-100 transition">
                              تعديل
                            </button>
                            <button onClick={() => setDeletingStudent(student)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition">
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
      {showAddModal && (
        <AddEditStudentModal onClose={() => setShowAddModal(false)} onSaved={handleStudentSaved} />
      )}
      {editingStudent && (
        <AddEditStudentModal student={editingStudent} onClose={() => setEditingStudent(null)}
          onSaved={(s) => { handleStudentSaved(s); setEditingStudent(null); }} />
      )}
      {viewingStudent && (
        <StudentDetailsModal student={viewingStudent} onClose={() => setViewingStudent(null)} />
      )}
      {payingStudent && (
        <PaymentModal student={payingStudent} onClose={() => setPayingStudent(null)} onPaid={handlePaymentMade} />
      )}
      {renewingStudent && (
        <RenewalModal student={renewingStudent} onClose={() => setRenewingStudent(null)} onRenewed={handleRenewed} />
      )}
      {deletingStudent && (
        <DeleteConfirmModal student={deletingStudent} onClose={() => setDeletingStudent(null)} onDeleted={handleDeleted} />
      )}
    </div>
  );
}
