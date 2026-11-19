import { monthPrefix } from "./dates";
import type { Employee, Expense, MonthRef, Payment, Salary } from "./types";

export interface FinanceData {
  payments: Payment[];
  expenses: Expense[];
  salaries: Salary[];
  employees: Employee[];
}

export interface SalaryRow extends Salary {
  employee: Employee;
}

export interface MonthSummary {
  revenue: number;
  paymentCount: number;
  expenses: number;
  salaries: number;
  /** صافي الربح = الإيرادات − المصاريف − المرتبات (نفس الحساب في كل الصفحات) */
  netProfit: number;
  expensesByType: Record<string, number>;
  salaryRows: SalaryRow[];
}

/** ملخص مالي لشهر واحد. الرئيسية والتقارير بيستخدموا نفس الدالة فالأرقام دايمًا متطابقة. */
export function monthSummary(ref: MonthRef, data: FinanceData): MonthSummary {
  const prefix = monthPrefix(ref);
  const inMonth = (x: { month: number; year: number }) =>
    x.month === ref.month && x.year === ref.year;

  let revenue = 0;
  let paymentCount = 0;
  for (const p of data.payments) {
    if (!p.date.startsWith(prefix)) continue;
    revenue += p.amount;
    paymentCount++;
  }

  let expenses = 0;
  const expensesByType: Record<string, number> = {};
  for (const e of data.expenses) {
    if (!inMonth(e)) continue;
    expenses += e.amount;
    expensesByType[e.type] = (expensesByType[e.type] ?? 0) + e.amount;
  }

  // مرتبات الموظفين المعروفين بس (الموظف المحذوف من القائمة لسه معروف ومرتباته محسوبة).
  const employeesById = new Map(data.employees.map((e) => [e.id, e]));
  let salaries = 0;
  const salaryRows: SalaryRow[] = [];
  for (const s of data.salaries) {
    const employee = employeesById.get(s.employeeId);
    if (!employee || !inMonth(s)) continue;
    salaries += s.amount;
    salaryRows.push({ ...s, employee });
  }
  salaryRows.sort((a, b) => b.amount - a.amount);

  return {
    revenue,
    paymentCount,
    expenses,
    salaries,
    netProfit: revenue - expenses - salaries,
    expensesByType,
    salaryRows,
  };
}
