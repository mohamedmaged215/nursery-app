import type { MonthRef } from "./types";

// كل التواريخ بتتخزن كنص "YYYY-MM-DD" بتوقيت الجهاز المحلي (مش UTC).

export const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const pad = (n: number) => String(n).padStart(2, "0");

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** بيزود أيام على تاريخ نصي من غير ما يتأثر بالتوقيت الصيفي. بيرجع "" لو التاريخ مش صحيح. */
export function addDays(dateStr: string, days: number): string {
  const m = ISO_DATE.exec(dateStr ?? "");
  if (!m) return "";
  const t = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return t.toISOString().slice(0, 10);
}

export function monthOfDate(dateStr: string): MonthRef | null {
  const m = ISO_DATE.exec(dateStr ?? "");
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) - 1 };
}

export function currentMonth(): MonthRef {
  const now = new Date();
  return { month: now.getMonth(), year: now.getFullYear() };
}

/** "2026-11" */
export function monthPrefix({ month, year }: MonthRef): string {
  return `${year}-${pad(month + 1)}`;
}

/** أول يوم في الشهر: "2026-11-01" */
export function monthStart(ref: MonthRef): string {
  return `${monthPrefix(ref)}-01`;
}

export function shiftMonth({ month, year }: MonthRef, delta: number): MonthRef {
  const index = year * 12 + month + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}

export function monthIndex({ month, year }: MonthRef): number {
  return year * 12 + month;
}

export function monthLabel({ month, year }: MonthRef): string {
  return `${ARABIC_MONTHS[month]} ${year}`;
}

export function monthKey({ month, year }: MonthRef): string {
  return `${year}-${month}`;
}

export function parseMonthKey(key: string): MonthRef {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

const MAX_MONTH_OPTIONS = 60;

/**
 * قائمة شهور متصلة (الأحدث أولاً) من أقدم شهر فيه بيانات لحد الشهر الحالي
 * (أو أبعد لو فيه بيانات بتاريخ مستقبلي).
 */
export function buildMonthOptions(known: (MonthRef | null | undefined)[]): MonthRef[] {
  const now = monthIndex(currentMonth());
  let min = now;
  let max = now;
  for (const ref of known) {
    if (!ref || !Number.isInteger(ref.month) || !Number.isInteger(ref.year)) continue;
    if (ref.month < 0 || ref.month > 11) continue;
    const i = monthIndex(ref);
    if (i < min) min = i;
    if (i > max) max = i;
  }
  max = Math.min(max, now + 12);
  min = Math.max(min, max - MAX_MONTH_OPTIONS + 1);
  const options: MonthRef[] = [];
  for (let i = max; i >= min; i--) {
    options.push({ year: Math.floor(i / 12), month: i % 12 });
  }
  return options;
}
