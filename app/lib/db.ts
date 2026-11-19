import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
} from "firebase/firestore/lite";
import { db } from "./firebase";
import type { Employee, Expense, Payment, Salary, Student } from "./types";

// ─── قراءة آمنة للحقول (بيانات قديمة ممكن تكون ناقصة) ─────────────────────────

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (v == null ? "" : String(v));
const int = (v: unknown): number => (Number.isInteger(v) ? (v as number) : -1);

function toStudent(id: string, d: DocumentData): Student {
  const subscriptionAmount = num(d.subscriptionAmount);
  const previousDebt = num(d.previousDebt);
  const paidAmount = num(d.paidAmount);
  const totalAmount = d.totalAmount == null ? subscriptionAmount + previousDebt : num(d.totalAmount);
  return {
    id,
    name: str(d.name),
    phone: str(d.phone),
    type: d.type === "bus" ? "bus" : "street",
    area: str(d.area),
    subscriptionAmount,
    previousDebt,
    totalAmount,
    paidAmount,
    remainingAmount:
      d.remainingAmount == null ? Math.max(0, totalAmount - paidAmount) : num(d.remainingAmount),
    status: d.status === "inactive" ? "inactive" : "active",
    startDate: str(d.startDate),
    endDate: str(d.endDate),
    createdAt: str(d.createdAt),
  };
}

function toPayment(id: string, d: DocumentData): Payment {
  return {
    id,
    studentId: str(d.studentId),
    studentName: d.studentName == null ? undefined : str(d.studentName),
    amount: num(d.amount),
    date: typeof d.date === "string" ? d.date : "",
  };
}

function toExpense(id: string, d: DocumentData): Expense {
  return {
    id,
    name: str(d.name),
    amount: num(d.amount),
    date: str(d.date),
    type: str(d.type),
    month: int(d.month),
    year: int(d.year),
    createdAt: str(d.createdAt),
  };
}

function toEmployee(id: string, d: DocumentData): Employee {
  return {
    id,
    name: str(d.name),
    role: d.role === "teacher" || d.role === "driver" ? d.role : "other",
    monthlySalary: num(d.monthlySalary),
    createdAt: str(d.createdAt),
    deleted: d.deleted === true,
  };
}

function toSalary(id: string, d: DocumentData): Salary {
  return {
    id,
    employeeId: str(d.employeeId),
    amount: num(d.amount),
    month: int(d.month),
    year: int(d.year),
    date: str(d.date),
  };
}

// ─── Batches ──────────────────────────────────────────────────────────────────

const BATCH_LIMIT = 400;

async function deleteRefs(refs: DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(i, i + BATCH_LIMIT)) batch.delete(ref);
    await batch.commit();
  }
}

// ─── الطلاب ───────────────────────────────────────────────────────────────────

export async function fetchStudents(): Promise<Student[]> {
  const snap = await getDocs(collection(db, "students"));
  return snap.docs.map((d) => toStudent(d.id, d.data()));
}

export async function createStudent(data: Omit<Student, "id">): Promise<Student> {
  const ref = await addDoc(collection(db, "students"), { ...data, busAmount: 0 });
  return { id: ref.id, ...data };
}

export async function updateStudent(id: string, patch: DocumentData): Promise<void> {
  await updateDoc(doc(db, "students", id), patch);
}

export async function markStudentsExpired(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + BATCH_LIMIT)) {
      batch.update(doc(db, "students", id), { status: "inactive" });
    }
    await batch.commit();
  }
}

/** بيحذف الطالب. دفعاته بتفضل محفوظة (عشان إيرادات الشهور السابقة) إلا لو withPayments. */
export async function deleteStudent(id: string, withPayments: boolean): Promise<void> {
  const refs: DocumentReference[] = [doc(db, "students", id)];
  if (withPayments) {
    const snap = await getDocs(query(collection(db, "payments"), where("studentId", "==", id)));
    refs.push(...snap.docs.map((d) => d.ref));
  }
  await deleteRefs(refs);
}

// ─── الدفعات ──────────────────────────────────────────────────────────────────

/** دفعات من تاريخ `from` (شامل) لحد `before` (غير شامل) لو اتحدد. */
export async function fetchPayments(from: string, before?: string): Promise<Payment[]> {
  const constraints = [where("date", ">=", from)];
  if (before) constraints.push(where("date", "<", before));
  const snap = await getDocs(query(collection(db, "payments"), ...constraints));
  return snap.docs.map((d) => toPayment(d.id, d.data()));
}

export async function fetchStudentPayments(studentId: string): Promise<Payment[]> {
  const snap = await getDocs(query(collection(db, "payments"), where("studentId", "==", studentId)));
  return snap.docs.map((d) => toPayment(d.id, d.data()));
}

/** تاريخ أقدم دفعة مسجلة (قراءة مستند واحد بس). */
export async function fetchEarliestPaymentDate(): Promise<string | null> {
  const snap = await getDocs(
    query(collection(db, "payments"), where("date", ">=", ""), orderBy("date"), limit(1))
  );
  const date = snap.docs[0]?.data().date;
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date) ? date : null;
}

/** بيسجل الدفعة ويحدّث رصيد الطالب في عملية واحدة (يا الاتنين يا ولا واحدة). */
export async function addPayment(
  payment: Omit<Payment, "id">,
  studentPatch: DocumentData
): Promise<Payment> {
  const ref = doc(collection(db, "payments"));
  const batch = writeBatch(db);
  batch.set(ref, payment);
  batch.update(doc(db, "students", payment.studentId), studentPatch);
  await batch.commit();
  return { id: ref.id, ...payment };
}

export async function deletePayment(
  paymentId: string,
  studentId: string | null,
  studentPatch: DocumentData | null
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, "payments", paymentId));
  if (studentId && studentPatch) batch.update(doc(db, "students", studentId), studentPatch);
  await batch.commit();
}

// ─── المصاريف ─────────────────────────────────────────────────────────────────

export async function fetchExpenses(): Promise<Expense[]> {
  const snap = await getDocs(collection(db, "expenses"));
  return snap.docs.map((d) => toExpense(d.id, d.data()));
}

export async function createExpense(data: Omit<Expense, "id">): Promise<Expense> {
  const ref = await addDoc(collection(db, "expenses"), data);
  return { id: ref.id, ...data };
}

export async function updateExpense(id: string, patch: DocumentData): Promise<void> {
  await updateDoc(doc(db, "expenses", id), patch);
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, "expenses", id));
}

// ─── الموظفين والمرتبات ───────────────────────────────────────────────────────

export async function fetchEmployees(): Promise<Employee[]> {
  const snap = await getDocs(collection(db, "employees"));
  return snap.docs.map((d) => toEmployee(d.id, d.data()));
}

export async function createEmployee(data: Omit<Employee, "id" | "deleted">): Promise<Employee> {
  const ref = await addDoc(collection(db, "employees"), { ...data, area: "" });
  return { id: ref.id, ...data };
}

export async function updateEmployee(id: string, patch: DocumentData): Promise<void> {
  await updateDoc(doc(db, "employees", id), patch);
}

/** حذف نهائي للموظف ومعاه سجلات المرتبات المحددة. */
export async function deleteEmployee(id: string, salaryIds: string[]): Promise<void> {
  await deleteRefs([
    doc(db, "employees", id),
    ...salaryIds.map((salaryId) => doc(db, "salaries", salaryId)),
  ]);
}

export async function fetchSalaries(): Promise<Salary[]> {
  const snap = await getDocs(collection(db, "salaries"));
  return snap.docs.map((d) => toSalary(d.id, d.data()));
}

export async function createSalary(data: Omit<Salary, "id">): Promise<Salary> {
  const ref = await addDoc(collection(db, "salaries"), data);
  return { id: ref.id, ...data };
}

export async function deleteSalary(id: string): Promise<void> {
  await deleteDoc(doc(db, "salaries", id));
}
