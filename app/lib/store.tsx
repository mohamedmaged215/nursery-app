"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import * as db from "./db";
import { addDays, currentMonth, monthOfDate, monthStart, shiftMonth, todayISO } from "./dates";
import {
  SUBSCRIPTION_DAYS,
  computeTotals,
  isExpired,
  paymentPatch,
  paymentRevertPatch,
  renewalPatch,
  statusForEndDate,
  type RenewalInput,
} from "./studentMath";
import type {
  Employee,
  EmployeeRole,
  Expense,
  ExpenseType,
  Payment,
  Salary,
  Student,
  StudentType,
} from "./types";

// ─── الحالة ───────────────────────────────────────────────────────────────────

interface Slices {
  students: Student[] | null; // null = لسه بيتحمّل
  payments: Payment[] | null;
  expenses: Expense[] | null;
  employees: Employee[] | null; // شامل المحذوفين (deleted) عشان التقارير
  salaries: Salary[] | null;
}
type SliceKey = keyof Slices;

interface State extends Slices {
  /** الدفعات محمّلة من التاريخ ده وطالع (مش من أول يوم، عشان السرعة). */
  paymentsFrom: string;
  earliestPaymentDate: string | null;
}

export interface StudentInput {
  name: string;
  phone: string;
  type: StudentType;
  area: string;
  subscriptionAmount: number;
  startDate: string;
}

export interface StudentEditInput extends StudentInput {
  previousDebt: number;
}

export interface ExpenseInput {
  name: string;
  amount: number;
  date: string;
  type: ExpenseType;
}

export interface EmployeeInput {
  name: string;
  role: EmployeeRole;
  monthlySalary: number;
}

export interface SalaryInput {
  employeeId: string;
  amount: number;
  month: number;
  year: number;
}

interface DataContextValue extends State {
  error: boolean;
  refreshing: boolean;
  refresh: () => void;
  ensurePaymentsFrom: (date: string) => void;

  addStudent: (input: StudentInput) => Promise<void>;
  editStudent: (id: string, input: StudentEditInput) => Promise<void>;
  renewStudent: (id: string, input: RenewalInput) => Promise<void>;
  payStudent: (id: string, amount: number, date: string) => Promise<void>;
  removePayment: (payment: Payment) => Promise<void>;
  removeStudent: (id: string, withPayments: boolean) => Promise<void>;

  saveExpense: (input: ExpenseInput, id?: string) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;

  saveEmployee: (input: EmployeeInput, id?: string) => Promise<void>;
  removeEmployee: (id: string, withSalaries: boolean) => Promise<void>;
  addSalary: (input: SalaryInput) => Promise<void>;
  removeSalary: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const value = useContext(DataContext);
  if (!value) throw new Error("useData must be used inside <DataProvider>");
  return value;
}

// ─── إعدادات ──────────────────────────────────────────────────────────────────

/** بنحمّل دفعات آخر 12 شهر بس في الأول؛ الأقدم بيتحمّل لما تختار شهر قديم. */
const PAYMENTS_WINDOW_MONTHS = 12;
/** لو البيانات أقدم من كده بنحدّثها في الخلفية عند التنقل أو الرجوع للتبويب. */
const STALE_AFTER_MS = 5 * 60 * 1000;
const MAX_LOAD_ATTEMPTS = 3;

function initialPaymentsFrom(): string {
  return monthStart(shiftMonth(currentMonth(), -(PAYMENTS_WINDOW_MONTHS - 1)));
}

function mergePayments(older: Payment[], current: Payment[]): Payment[] {
  const seen = new Set(current.map((p) => p.id));
  return [...older.filter((p) => !seen.has(p.id)), ...current];
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(() => ({
    students: null,
    payments: null,
    expenses: null,
    employees: null,
    salaries: null,
    paymentsFrom: initialPaymentsFrom(),
    earliestPaymentDate: null,
  }));
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const pathname = usePathname();

  // أحدث نسخة من الحالة، للاستخدام جوه الأحداث (مش وقت الرسم).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // رقم بيزيد مع كل تعديل محلي؛ أي تحميل بدأ قبل التعديل نتيجته بتتجاهل ويتعاد.
  const versions = useRef<Record<SliceKey, number>>({
    students: 0,
    payments: 0,
    expenses: 0,
    employees: 0,
    salaries: 0,
  });
  const wantedPaymentsFrom = useRef(state.paymentsFrom);
  const loadedAt = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);

  const bump = useCallback((...keys: SliceKey[]) => {
    for (const key of keys) versions.current[key]++;
  }, []);

  // ── التحميل ────────────────────────────────────────────────────────────────

  const loadSlice = useCallback(
    async <K extends SliceKey>(key: K, fetcher: () => Promise<NonNullable<Slices[K]>>) => {
      for (let attempt = 0; attempt < MAX_LOAD_ATTEMPTS; attempt++) {
        const version = versions.current[key];
        const data = await fetcher();
        if (versions.current[key] !== version) continue;
        setState((s) => ({ ...s, [key]: data }));
        return;
      }
    },
    []
  );

  const loadStudents = useCallback(
    () =>
      loadSlice("students", async () => {
        const list = await db.fetchStudents();
        // الاشتراكات اللي خلصت بتتحول "منتهي" هنا، فكل الصفحات بتشوف نفس الحالة.
        const today = todayISO();
        const expired = list.filter((s) => isExpired(s, today));
        if (expired.length === 0) return list;
        db.markStudentsExpired(expired.map((s) => s.id)).catch(console.error);
        const ids = new Set(expired.map((s) => s.id));
        return list.map((s) => (ids.has(s.id) ? { ...s, status: "inactive" as const } : s));
      }),
    [loadSlice]
  );

  const loadPayments = useCallback(async () => {
    for (let attempt = 0; attempt < MAX_LOAD_ATTEMPTS; attempt++) {
      const version = versions.current.payments;
      const from = wantedPaymentsFrom.current;
      const data = await db.fetchPayments(from);
      if (versions.current.payments !== version || wantedPaymentsFrom.current !== from) continue;
      setState((s) => ({ ...s, payments: data, paymentsFrom: from }));
      return;
    }
  }, []);

  const loadAll = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    const run = (async () => {
      try {
        await Promise.all([
          loadStudents(),
          loadPayments(),
          loadSlice("expenses", db.fetchExpenses),
          loadSlice("employees", db.fetchEmployees),
          loadSlice("salaries", db.fetchSalaries),
          db
            .fetchEarliestPaymentDate()
            .then((date) => setState((s) => ({ ...s, earliestPaymentDate: date })))
            .catch(console.error),
        ]);
        loadedAt.current = Date.now();
        setError(false);
      } catch (e) {
        console.error(e);
        setError(true);
      } finally {
        inFlight.current = null;
        setRefreshing(false);
      }
    })();
    inFlight.current = run;
    return run;
  }, [loadSlice, loadStudents, loadPayments]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const refreshIfStale = useCallback(() => {
    if (loadedAt.current && Date.now() - loadedAt.current > STALE_AFTER_MS) loadAll();
  }, [loadAll]);

  useEffect(() => {
    refreshIfStale();
  }, [pathname, refreshIfStale]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshIfStale();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshIfStale]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    loadAll();
  }, [loadAll]);

  const ensurePaymentsFrom = useCallback((date: string) => {
    if (!stateRef.current.payments) return; // التحميل الأول لسه شغال
    if (date >= wantedPaymentsFrom.current) return;
    const upper = wantedPaymentsFrom.current;
    wantedPaymentsFrom.current = date;
    db.fetchPayments(date, upper)
      .then((older) => {
        setState((s) => {
          if (!s.payments) return s;
          return {
            ...s,
            payments: mergePayments(older, s.payments),
            paymentsFrom: date < s.paymentsFrom ? date : s.paymentsFrom,
          };
        });
      })
      .catch((e) => {
        // زرار "إعادة المحاولة" بيحمّل من wantedPaymentsFrom فهيجيب المدى ده.
        console.error(e);
        setError(true);
      });
  }, []);

  // ── الطلاب ─────────────────────────────────────────────────────────────────

  const requireStudent = useCallback((id: string): Student => {
    const student = stateRef.current.students?.find((s) => s.id === id);
    if (!student) throw new Error(`student ${id} not found`);
    return student;
  }, []);

  const patchStudent = useCallback(
    (id: string, patch: Partial<Student>) => {
      bump("students");
      setState((s) => ({
        ...s,
        students: s.students?.map((x) => (x.id === id ? { ...x, ...patch } : x)) ?? null,
      }));
    },
    [bump]
  );

  const addStudent = useCallback(
    async (input: StudentInput) => {
      const today = todayISO();
      const endDate = addDays(input.startDate, SUBSCRIPTION_DAYS);
      const student = await db.createStudent({
        ...input,
        previousDebt: 0,
        totalAmount: input.subscriptionAmount,
        paidAmount: 0,
        remainingAmount: input.subscriptionAmount,
        status: statusForEndDate(endDate, today),
        endDate,
        createdAt: today,
      });
      bump("students");
      setState((s) => ({ ...s, students: s.students ? [student, ...s.students] : null }));
    },
    [bump]
  );

  const editStudent = useCallback(
    async (id: string, input: StudentEditInput) => {
      const current = requireStudent(id);
      const patch: Partial<Student> = {
        name: input.name,
        phone: input.phone,
        type: input.type,
        area: input.area,
        subscriptionAmount: input.subscriptionAmount,
        previousDebt: input.previousDebt,
        ...computeTotals(input.subscriptionAmount, input.previousDebt, current.paidAmount),
      };
      if (input.startDate && input.startDate !== current.startDate) {
        patch.startDate = input.startDate;
        patch.endDate = addDays(input.startDate, SUBSCRIPTION_DAYS);
        patch.status = statusForEndDate(patch.endDate, todayISO());
      }
      await db.updateStudent(id, { ...patch, busAmount: 0 });
      patchStudent(id, patch);
    },
    [requireStudent, patchStudent]
  );

  const renewStudent = useCallback(
    async (id: string, input: RenewalInput) => {
      const { busAmount, ...patch } = renewalPatch(requireStudent(id), input, todayISO());
      await db.updateStudent(id, { ...patch, busAmount });
      patchStudent(id, patch);
    },
    [requireStudent, patchStudent]
  );

  const payStudent = useCallback(
    async (id: string, amount: number, date: string) => {
      const current = requireStudent(id);
      const patch = paymentPatch(current, amount);
      const payment = await db.addPayment(
        { studentId: id, studentName: current.name, amount, date },
        patch
      );
      bump("payments");
      setState((s) => ({
        ...s,
        payments:
          s.payments && payment.date >= s.paymentsFrom ? [...s.payments, payment] : s.payments,
        earliestPaymentDate:
          s.earliestPaymentDate && s.earliestPaymentDate <= payment.date
            ? s.earliestPaymentDate
            : payment.date,
      }));
      patchStudent(id, patch);
    },
    [requireStudent, patchStudent, bump]
  );

  const removePayment = useCallback(
    async (payment: Payment) => {
      const student = stateRef.current.students?.find((s) => s.id === payment.studentId);
      const patch = student ? paymentRevertPatch(student, payment.amount) : null;
      await db.deletePayment(payment.id, student?.id ?? null, patch);
      bump("payments");
      setState((s) => ({
        ...s,
        payments: s.payments?.filter((p) => p.id !== payment.id) ?? null,
      }));
      if (student && patch) patchStudent(student.id, patch);
    },
    [patchStudent, bump]
  );

  const removeStudent = useCallback(
    async (id: string, withPayments: boolean) => {
      await db.deleteStudent(id, withPayments);
      bump("students", "payments");
      setState((s) => ({
        ...s,
        students: s.students?.filter((x) => x.id !== id) ?? null,
        payments:
          withPayments && s.payments ? s.payments.filter((p) => p.studentId !== id) : s.payments,
      }));
    },
    [bump]
  );

  // ── المصاريف ───────────────────────────────────────────────────────────────

  const saveExpense = useCallback(
    async (input: ExpenseInput, id?: string) => {
      const ref = monthOfDate(input.date);
      if (!ref) throw new Error("invalid expense date");
      const fields = { ...input, month: ref.month, year: ref.year };
      if (id) {
        await db.updateExpense(id, fields);
        bump("expenses");
        setState((s) => ({
          ...s,
          expenses: s.expenses?.map((e) => (e.id === id ? { ...e, ...fields } : e)) ?? null,
        }));
      } else {
        const expense = await db.createExpense({ ...fields, createdAt: todayISO() });
        bump("expenses");
        setState((s) => ({ ...s, expenses: s.expenses ? [expense, ...s.expenses] : null }));
      }
    },
    [bump]
  );

  const removeExpense = useCallback(
    async (id: string) => {
      await db.deleteExpense(id);
      bump("expenses");
      setState((s) => ({ ...s, expenses: s.expenses?.filter((e) => e.id !== id) ?? null }));
    },
    [bump]
  );

  // ── الموظفين والمرتبات ─────────────────────────────────────────────────────

  const saveEmployee = useCallback(
    async (input: EmployeeInput, id?: string) => {
      if (id) {
        await db.updateEmployee(id, { ...input });
        bump("employees");
        setState((s) => ({
          ...s,
          employees: s.employees?.map((e) => (e.id === id ? { ...e, ...input } : e)) ?? null,
        }));
      } else {
        const employee = await db.createEmployee({ ...input, createdAt: todayISO() });
        bump("employees");
        setState((s) => ({ ...s, employees: s.employees ? [employee, ...s.employees] : null }));
      }
    },
    [bump]
  );

  const removeEmployee = useCallback(
    async (id: string, withSalaries: boolean) => {
      const salaryIds = (stateRef.current.salaries ?? [])
        .filter((s) => s.employeeId === id)
        .map((s) => s.id);
      if (withSalaries || salaryIds.length === 0) {
        await db.deleteEmployee(id, salaryIds);
        bump("employees", "salaries");
        setState((s) => ({
          ...s,
          employees: s.employees?.filter((e) => e.id !== id) ?? null,
          salaries: s.salaries?.filter((x) => x.employeeId !== id) ?? null,
        }));
      } else {
        // ليه مرتبات مسجلة: بنخفيه من القائمة بس، عشان تقارير الشهور السابقة ما تتغيرش.
        await db.updateEmployee(id, { deleted: true });
        bump("employees");
        setState((s) => ({
          ...s,
          employees: s.employees?.map((e) => (e.id === id ? { ...e, deleted: true } : e)) ?? null,
        }));
      }
    },
    [bump]
  );

  const addSalary = useCallback(
    async (input: SalaryInput) => {
      const salary = await db.createSalary({ ...input, date: todayISO() });
      bump("salaries");
      setState((s) => ({ ...s, salaries: s.salaries ? [salary, ...s.salaries] : null }));
    },
    [bump]
  );

  const removeSalary = useCallback(
    async (id: string) => {
      await db.deleteSalary(id);
      bump("salaries");
      setState((s) => ({ ...s, salaries: s.salaries?.filter((x) => x.id !== id) ?? null }));
    },
    [bump]
  );

  const value = useMemo<DataContextValue>(
    () => ({
      ...state,
      error,
      refreshing,
      refresh,
      ensurePaymentsFrom,
      addStudent,
      editStudent,
      renewStudent,
      payStudent,
      removePayment,
      removeStudent,
      saveExpense,
      removeExpense,
      saveEmployee,
      removeEmployee,
      addSalary,
      removeSalary,
    }),
    [
      state,
      error,
      refreshing,
      refresh,
      ensurePaymentsFrom,
      addStudent,
      editStudent,
      renewStudent,
      payStudent,
      removePayment,
      removeStudent,
      saveExpense,
      removeExpense,
      saveEmployee,
      removeEmployee,
      addSalary,
      removeSalary,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
