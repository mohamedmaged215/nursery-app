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
  busAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: "active" | "inactive";
  startDate: string;
  endDate: string;
  createdAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_AREAS = ["شرق الكوبري", "البلدة", "العرب"];

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

async function renewStudent(
  id: string,
  subscriptionAmount: number,
  busAmount: number,
  type: "street" | "bus"
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const total = subscriptionAmount + (type === "bus" ? busAmount : 0);
  await updateDoc(doc(db, "students", id), {
    status: "active",
    subscriptionAmount,
    busAmount: type === "bus" ? busAmount : 0,
    totalAmount: total,
    paidAmount: 0,
    remainingAmount: total,
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

// Batch-expire students whose endDate has passed
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

// ─── Add Student Modal ────────────────────────────────────────────────────────

function AddStudentModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (student: Student) => void;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<"street" | "bus">("street");
  const [area, setArea] = useState(DEFAULT_AREAS[0]);
  const [customArea, setCustomArea] = useState("");
  const [subscriptionAmount, setSubscriptionAmount] = useState("");
  const [busAmount, setBusAmount] = useState("");
  const [startDate, setStartDate] = useState(todayStr);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const effectiveArea = area === "__custom__" ? customArea : area;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const sub = Number(subscriptionAmount);
    const bus = type === "bus" ? Number(busAmount) || 0 : 0;
    if (!name.trim() || !phone.trim()) { setError("يرجى ملء جميع الحقول المطلوبة"); return; }
    if (type === "bus" && !effectiveArea.trim()) { setError("يرجى تحديد المنطقة"); return; }
    if (isNaN(sub) || sub <= 0) { setError("يرجى إدخال مبلغ اشتراك صحيح"); return; }
    setSaving(true);
    try {
      const total = sub + bus;
      const data: Omit<Student, "id"> = {
        name: name.trim(),
        phone: phone.trim(),
        type,
        area: type === "bus" ? effectiveArea.trim() : "",
        subscriptionAmount: sub,
        busAmount: bus,
        totalAmount: total,
        paidAmount: 0,
        remainingAmount: total,
        status: "active",
        startDate,
        endDate: addDays(startDate, 30),
        createdAt: new Date().toISOString().slice(0, 10),
      };
      const id = await createStudent(data);
      onSave({ id, ...data });
      onClose();
    } catch {
      setError("حدث خطأ أثناء الحفظ. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 my-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">إضافة طالب جديد</h2>
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
            <label className="block text-sm font-semibold text-gray-700 mb-1">نوع الاشتراك *</label>
            <div className="flex gap-3">
              {(["street", "bus"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition border ${
                    type === t ? "bg-[#1976d2] text-white border-[#1976d2]" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}>
                  {t === "street" ? "بدون مواصلات" : "عربية"}
                </button>
              ))}
            </div>
          </div>

          {type === "bus" && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">المنطقة *</label>
                <select value={area} onChange={(e) => setArea(e.target.value)} className={inputCls}>
                  {DEFAULT_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                  <option value="__custom__">أخرى...</option>
                </select>
              </div>
              {area === "__custom__" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">اسم المنطقة</label>
                  <input type="text" value={customArea} onChange={(e) => setCustomArea(e.target.value)}
                    placeholder="أدخل اسم المنطقة" className={inputCls} />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">مبلغ العربية (جنيه)</label>
                <input type="number" min="0" value={busAmount} onChange={(e) => setBusAmount(e.target.value)}
                  placeholder="0" dir="ltr" className={inputCls} />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">مبلغ الاشتراك (جنيه) *</label>
            <input type="number" min="1" required value={subscriptionAmount}
              onChange={(e) => setSubscriptionAmount(e.target.value)} placeholder="0" dir="ltr" className={inputCls} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">تاريخ بدء الاشتراك</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              dir="ltr" className={inputCls} />
            <p className="text-xs text-gray-400 mt-1">تاريخ الانتهاء: {addDays(startDate, 30)}</p>
          </div>

          {subscriptionAmount && (
            <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-900">
              <span>الإجمالي: <span className="font-bold">
                {((Number(subscriptionAmount) || 0) + (type === "bus" ? Number(busAmount) || 0 : 0)).toLocaleString()} جنيه
              </span></span>
              <p className="text-xs text-blue-600 mt-1">ينتهي الاشتراك في {addDays(startDate, 30)}</p>
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
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </div>
        </form>
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
              placeholder="0" dir="ltr" autoFocus
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
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
  onRenewed: (id: string, sub: number, bus: number, total: number) => void;
}) {
  const [subAmount, setSubAmount] = useState(String(student.subscriptionAmount || ""));
  const [busAmt,    setBusAmt]    = useState(String(student.busAmount || ""));
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const sub   = Number(subAmount) || 0;
  const bus   = student.type === "bus" ? Number(busAmt) || 0 : 0;
  const total = sub + bus;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (sub <= 0) { setError("يرجى إدخال مبلغ اشتراك صحيح"); return; }
    setSaving(true);
    try {
      await renewStudent(student.id, sub, bus, student.type);
      onRenewed(student.id, sub, bus, total);
      onClose();
    } catch {
      setError("حدث خطأ أثناء الحفظ. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";

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
            {student.type === "bus" ? `عربية · ${student.area}` : "بدون مواصلات"}
            {student.endDate ? ` · انتهى: ${student.endDate}` : ""}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">مبلغ الاشتراك الجديد (جنيه) *</label>
            <input type="number" min="1" required dir="ltr" autoFocus
              value={subAmount} onChange={(e) => setSubAmount(e.target.value)}
              placeholder="0" className={inputCls} />
          </div>

          {student.type === "bus" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">مبلغ العربية (جنيه)</label>
              <input type="number" min="0" dir="ltr"
                value={busAmt} onChange={(e) => setBusAmt(e.target.value)}
                placeholder="0" className={inputCls} />
            </div>
          )}

          {sub > 0 && (
            <div className="bg-green-50 rounded-xl px-4 py-3 text-sm text-green-900">
              الإجمالي الجديد: <span className="font-bold">{total.toLocaleString()} جنيه</span>
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

  function handleStudentAdded(student: Student) {
    setStudents((prev) => [student, ...prev]);
  }

  function handlePaymentMade(studentId: string, newPaid: number, newRemaining: number) {
    setStudents((prev) =>
      prev.map((s) => s.id === studentId ? { ...s, paidAmount: newPaid, remainingAmount: newRemaining } : s)
    );
  }

  function handleDeleted(id: string) {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  }

  function handleRenewed(id: string, sub: number, bus: number, total: number) {
    const today = new Date().toISOString().slice(0, 10);
    setStudents((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: "active", subscriptionAmount: sub, busAmount: bus, totalAmount: total,
              paidAmount: 0, remainingAmount: total, startDate: today, endDate: addDays(today, 30) }
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
            <button
              onClick={() => setTab("active")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                tab === "active" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              نشط ({activeCount})
            </button>
            <button
              onClick={() => setTab("inactive")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                tab === "inactive" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              اشتراكات منتهية ({inactiveCount})
            </button>
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الموبايل..."
            className="w-full sm:max-w-xs px-3.5 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        {/* ── Table ───────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-xl h-14 animate-pulse" />
            ))}
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
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-right">
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">الاسم</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">موبايل ولي الأمر</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">النوع</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">المنطقة</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">مبلغ الاشتراك</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">مبلغ العربية</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">المدفوع</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">الباقي</th>
                    {tab === "active" && (
                      <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">ينتهي</th>
                    )}
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((student) => {
                    const waMsg = `السلام عليكم مع حضرتك إدارة الحضانة\nبنفكركم إن اشتراك الطفل ${student.name} انتهى\nبرجاء تجديد الاشتراك\nمع تحيات إدارة حضانة شرق الكوبري`;
                    const waUrl = `https://wa.me/2${student.phone}?text=${encodeURIComponent(waMsg)}`;
                    const today = new Date().toISOString().slice(0, 10);
                    const expiringSoon = student.endDate && student.endDate > today &&
                      student.endDate <= addDays(today, 5);
                    return (
                      <tr key={student.id} className={`hover:bg-gray-50 transition ${student.status === "inactive" ? "opacity-75" : ""}`}>
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{student.name}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap" dir="ltr">{student.phone}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            student.type === "bus" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                          }`}>
                            {student.type === "bus" ? "عربية" : "بدون مواصلات"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {student.type === "bus" && student.area ? student.area : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                          {student.subscriptionAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                          {student.type === "bus" ? student.busAmount.toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-medium text-green-700">{student.paidAmount.toLocaleString()}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`font-medium ${student.remainingAmount > 0 ? "text-orange-600" : "text-green-600"}`}>
                            {student.remainingAmount.toLocaleString()}
                          </span>
                        </td>
                        {tab === "active" && (
                          <td className="px-4 py-3 whitespace-nowrap text-xs">
                            {student.endDate ? (
                              <span className={expiringSoon ? "text-red-600 font-semibold" : "text-gray-500"}>
                                {student.endDate}
                                {expiringSoon && " ⚠"}
                              </span>
                            ) : "—"}
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {student.status === "active" ? (
                              <>
                                <button
                                  onClick={() => setPayingStudent(student)}
                                  className="px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition"
                                >
                                  دفع
                                </button>
                                <a href={`https://wa.me/2${student.phone}`} target="_blank" rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition">
                                  واتساب
                                </a>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => setRenewingStudent(student)}
                                  className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition"
                                >
                                  تجديد
                                </button>
                                <a href={waUrl} target="_blank" rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition">
                                  واتساب
                                </a>
                              </>
                            )}
                            <button
                              onClick={() => setDeletingStudent(student)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition"
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
              {filtered.length} طالب
            </div>
          </div>
        )}
      </main>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showAddModal && (
        <AddStudentModal onClose={() => setShowAddModal(false)} onSave={handleStudentAdded} />
      )}

      {payingStudent && (
        <PaymentModal
          student={payingStudent}
          onClose={() => setPayingStudent(null)}
          onPaid={handlePaymentMade}
        />
      )}

      {renewingStudent && (
        <RenewalModal
          student={renewingStudent}
          onClose={() => setRenewingStudent(null)}
          onRenewed={handleRenewed}
        />
      )}

      {deletingStudent && (
        <DeleteConfirmModal
          student={deletingStudent}
          onClose={() => setDeletingStudent(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
