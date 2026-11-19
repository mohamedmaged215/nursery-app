"use client";

import { useEffect } from "react";
import { monthKey, monthLabel, parseMonthKey } from "../lib/dates";
import type { MonthRef } from "../lib/types";

export const inputCls =
  "w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";

const MODAL_WIDTH = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" };

export function Modal({
  title,
  subtitle,
  size = "md",
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  size?: keyof typeof MODAL_WIDTH;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-6 overflow-y-auto">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${MODAL_WIDTH[size]} p-6 my-auto`}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
      {children}
    </p>
  );
}

const SUBMIT_COLORS = {
  blue: "bg-[#1976d2] hover:bg-blue-700",
  green: "bg-green-600 hover:bg-green-700",
  red: "bg-red-600 hover:bg-red-700",
};

/** زرارين أسفل النافذة: إلغاء + تأكيد. لو onSubmit مش متحدد الزرار بيبقى submit للفورم. */
export function ModalActions({
  onCancel,
  onSubmit,
  submitLabel,
  busyLabel = "جارٍ الحفظ...",
  busy,
  color = "blue",
}: {
  onCancel: () => void;
  onSubmit?: () => void;
  submitLabel: string;
  busyLabel?: string;
  busy: boolean;
  color?: keyof typeof SUBMIT_COLORS;
}) {
  return (
    <div className="flex gap-3 pt-1">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
      >
        إلغاء
      </button>
      <button
        type={onSubmit ? "button" : "submit"}
        onClick={onSubmit}
        disabled={busy}
        className={`flex-1 py-2.5 rounded-lg text-white text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed transition ${SUBMIT_COLORS[color]}`}
      >
        {busy ? busyLabel : submitLabel}
      </button>
    </div>
  );
}

export function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="mt-5 w-full py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
    >
      إغلاق
    </button>
  );
}

export function MonthSelect({
  value,
  options,
  onChange,
  className = "",
}: {
  value: MonthRef;
  options: MonthRef[];
  onChange: (ref: MonthRef) => void;
  className?: string;
}) {
  return (
    <select
      value={monthKey(value)}
      onChange={(e) => onChange(parseMonthKey(e.target.value))}
      className={`px-3.5 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition w-fit ${className}`}
    >
      {options.map((ref) => (
        <option key={monthKey(ref)} value={monthKey(ref)}>
          {monthLabel(ref)}
        </option>
      ))}
    </select>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="bg-gray-100 rounded-xl h-14 animate-pulse" />
      ))}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  );
}
