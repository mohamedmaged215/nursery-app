"use client";

import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { addExpense, getExpenses, deleteExpense } from "../lib/firebaseUtils";
import { Expense } from "../lib/types";

function DeleteModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-2">تأكيد الحذف</h3>
        <p className="text-sm text-gray-600 mb-6">هل أنت متأكد من حذف هذا المصروف؟</p>
        <div className="flex gap-3">
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">حذف</button>
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition">إلغاء</button>
        </div>
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState({ expenseName: "", price: "" });

  async function load() {
    setLoading(true);
    const data = await getExpenses();
    data.sort((a, b) => b.date.localeCompare(a.date));
    setExpenses(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.expenseName.trim() || !form.price) return;
    setSaving(true);
    const today = new Date().toISOString().split("T")[0];
    await addExpense({ expenseName: form.expenseName.trim(), price: Number(form.price), date: today });
    setForm({ expenseName: "", price: "" });
    await load();
    setSaving(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteExpense(deleteTarget);
    setExpenses((prev) => prev.filter((e) => e.id !== deleteTarget));
    setDeleteTarget(null);
  }

  const total = expenses.reduce((sum, e) => sum + e.price, 0);

  return (
    <div className="min-h-full">
      <Navbar />

      {deleteTarget && (
        <DeleteModal onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">المصاريف</h2>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
            <input
              required
              type="text"
              placeholder="اسم المصروف"
              value={form.expenseName}
              onChange={(e) => setForm((f) => ({ ...f, expenseName: e.target.value }))}
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
            />
            <input
              required
              type="number"
              min="0"
              placeholder="المبلغ"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="w-full sm:w-36 px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
            />
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {saving ? "…" : "إضافة"}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="divide-y divide-gray-100">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-50 animate-pulse" />)}
            </div>
          ) : expenses.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-16">لا توجد مصاريف.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">المصروف</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">المبلغ</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">التاريخ</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">{e.expenseName}</td>
                    <td className="px-4 py-3 text-gray-600">{e.price.toLocaleString()} جنيه</td>
                    <td className="px-4 py-3 text-gray-600">{e.date}</td>
                    <td className="px-4 py-3 text-left">
                      <button
                        onClick={() => setDeleteTarget(e.id)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition"
                        title="حذف"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && expenses.length > 0 && (
          <div className="mt-4 flex justify-end">
            <span className="text-sm font-semibold text-gray-700">
              إجمالي المصاريف: <span className="text-red-600">{total.toLocaleString()} جنيه</span>
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
