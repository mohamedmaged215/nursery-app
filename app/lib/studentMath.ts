import { addDays } from "./dates";
import type { Student, StudentStatus, StudentType } from "./types";

export const SUBSCRIPTION_DAYS = 30;

export function statusForEndDate(endDate: string, today: string): StudentStatus {
  return endDate && endDate > today ? "active" : "inactive";
}

export function isExpired(student: Pick<Student, "status" | "endDate">, today: string): boolean {
  return student.status === "active" && !!student.endDate && student.endDate <= today;
}

export function computeTotals(subscriptionAmount: number, previousDebt: number, paidAmount: number) {
  const totalAmount = subscriptionAmount + previousDebt;
  return { totalAmount, remainingAmount: Math.max(0, totalAmount - paidAmount) };
}

/** تسجيل دفعة: المدفوع يزيد والباقي يقل. */
export function paymentPatch(student: Student, amount: number) {
  const paidAmount = student.paidAmount + amount;
  return { paidAmount, remainingAmount: Math.max(0, student.totalAmount - paidAmount) };
}

/**
 * حذف دفعة اتسجلت غلط: مبلغها بيرجع على الطالب.
 * لو الدفعة من اشتراك قديم (المدفوع الحالي أقل منها) الفرق بيتضاف كمديونية سابقة.
 */
export function paymentRevertPatch(student: Student, amount: number) {
  const paidAmount = Math.max(0, student.paidAmount - amount);
  const shortfall = amount - (student.paidAmount - paidAmount);
  const previousDebt = student.previousDebt + shortfall;
  const totalAmount = student.totalAmount + shortfall;
  return {
    paidAmount,
    previousDebt,
    totalAmount,
    remainingAmount: Math.max(0, totalAmount - paidAmount),
  };
}

export interface RenewalInput {
  subscriptionAmount: number;
  type: StudentType;
  area: string;
  startDate: string;
  /** ترحيل الباقي من الاشتراك القديم على الاشتراك الجديد */
  carryDebt: boolean;
}

export function renewalPatch(student: Student, input: RenewalInput, today: string) {
  const previousDebt = input.carryDebt ? student.remainingAmount : 0;
  const endDate = addDays(input.startDate, SUBSCRIPTION_DAYS);
  const totalAmount = input.subscriptionAmount + previousDebt;
  return {
    status: statusForEndDate(endDate, today),
    type: input.type,
    area: input.area,
    subscriptionAmount: input.subscriptionAmount,
    busAmount: 0,
    previousDebt,
    totalAmount,
    paidAmount: 0,
    remainingAmount: totalAmount,
    startDate: input.startDate,
    endDate,
  };
}

/** بداية التجديد الافتراضية: من نهاية الاشتراك القديم لو لسه قريب، وإلا من النهارده. */
export function defaultRenewalStart(student: Pick<Student, "endDate">, today: string): string {
  if (!student.endDate) return today;
  const continuousEnd = addDays(student.endDate, SUBSCRIPTION_DAYS);
  return continuousEnd > today ? student.endDate : today;
}
