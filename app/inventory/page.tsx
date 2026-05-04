"use client";

import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import {
  addInventoryItem,
  getInventoryItems,
  updateInventoryItem,
  deleteInventoryItem,
  addInventoryPurchase,
} from "../lib/firebaseUtils";
import { InventoryItem } from "../lib/types";

function DeleteModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-2">تأكيد الحذف</h3>
        <p className="text-sm text-gray-600 mb-6">هل أنت متأكد من حذف هذا الصنف من المخزن؟</p>
        <div className="flex gap-3">
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">حذف</button>
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition">إلغاء</button>
        </div>
      </div>
    </div>
  );
}

function ItemModal({
  item,
  onSave,
  onCancel,
}: {
  item: InventoryItem | null;
  onSave: (data: { itemName: string; costPrice: number; quantity: number }) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    itemName: item?.itemName ?? "",
    costPrice: item ? String(item.costPrice) : "",
    quantity: item ? String(item.quantity) : "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({
      itemName: form.itemName.trim(),
      costPrice: Number(form.costPrice),
      quantity: Number(form.quantity),
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-5">
          {item ? "تعديل الصنف" : "إضافة صنف جديد"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم الصنف</label>
            <input
              required
              type="text"
              value={form.itemName}
              onChange={(e) => setForm((f) => ({ ...f, itemName: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">سعر التكلفة (جنيه)</label>
            <input
              required
              type="number"
              min="0"
              value={form.costPrice}
              onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الكمية</label>
            <input
              required
              type="number"
              min="0"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition"
            >
              {saving ? "…" : item ? "حفظ" : "إضافة"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<InventoryItem | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const data = await getInventoryItems();
    data.sort((a, b) => a.itemName.localeCompare(b.itemName));
    setItems(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave(data: { itemName: string; costPrice: number; quantity: number }) {
    if (editTarget === "new") {
      const today = new Date().toISOString().split("T")[0];
      await addInventoryItem(data);
      await addInventoryPurchase({
        itemName: data.itemName,
        costPrice: data.costPrice,
        quantity: data.quantity,
        totalCost: data.costPrice * data.quantity,
        date: today,
      });
    } else if (editTarget) {
      await updateInventoryItem(editTarget.id, data);
    }
    setEditTarget(null);
    await load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteInventoryItem(deleteTarget);
    setItems((prev) => prev.filter((i) => i.id !== deleteTarget));
    setDeleteTarget(null);
  }

  const totalValue = items.reduce((sum, i) => sum + i.costPrice * i.quantity, 0);

  return (
    <div className="min-h-full">
      <Navbar />

      {deleteTarget && (
        <DeleteModal onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
      )}

      {editTarget !== null && (
        <ItemModal
          item={editTarget === "new" ? null : editTarget}
          onSave={handleSave}
          onCancel={() => setEditTarget(null)}
        />
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">المخزن</h2>
          <button
            onClick={() => setEditTarget("new")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            إضافة صنف
          </button>
        </div>

        <div className="bg-blue-50 rounded-2xl p-4 sm:p-5 mb-6">
          <p className="text-xs sm:text-sm font-medium text-blue-700 opacity-75 mb-1">إجمالي قيمة المخزن</p>
          <p className="text-lg sm:text-xl font-bold text-blue-700">{totalValue.toLocaleString()} جنيه</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="divide-y divide-gray-100">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-50 animate-pulse" />)}
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-16">لا توجد أصناف في المخزن.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">الصنف</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">سعر التكلفة</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">الكمية</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">القيمة الكلية</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">{item.itemName}</td>
                    <td className="px-4 py-3 text-gray-600">{item.costPrice.toLocaleString()} جنيه</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        item.quantity === 0
                          ? "bg-red-100 text-red-700"
                          : item.quantity <= 5
                            ? "bg-orange-100 text-orange-700"
                            : "bg-green-100 text-green-700"
                      }`}>
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{(item.costPrice * item.quantity).toLocaleString()} جنيه</td>
                    <td className="px-4 py-3 text-left">
                      <div className="flex items-center justify-start gap-1">
                        <button
                          onClick={() => setEditTarget(item)}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition"
                          title="تعديل"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(item.id)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition"
                          title="حذف"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
