"use client";

import { useEffect, useState, useMemo } from "react";
import Navbar from "../components/Navbar";
import {
  getCustomers,
  getPayments,
  getSales,
  getExpenses,
  getInventoryPurchases,
} from "../lib/firebaseUtils";
import { Customer, Payment, Sale, Expense, InventoryPurchase } from "../lib/types";

function normalizeDate(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "object" && raw !== null && "seconds" in raw)
    return new Date((raw as { seconds: number }).seconds * 1000).toISOString().slice(0, 10);
  if (typeof raw === "object" && raw !== null && "toDate" in raw)
    return (raw as { toDate(): Date }).toDate().toISOString().slice(0, 10);
  return String(raw).slice(0, 10);
}

type TxType = "payment" | "sale" | "expense" | "purchase";

interface Transaction {
  id: string;
  type: TxType;
  description: string;
  amount: number;
  date: string;
}

const TX_LABELS: Record<TxType, string> = {
  payment:  "اشتراك",
  sale:     "بيع",
  expense:  "مصروف",
  purchase: "مشتريات",
};

const TX_STYLES: Record<TxType, string> = {
  payment:  "bg-green-100 text-green-700",
  sale:     "bg-blue-100 text-blue-700",
  expense:  "bg-red-100 text-red-700",
  purchase: "bg-orange-100 text-orange-700",
};

export default function TreasuryPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<InventoryPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  useEffect(() => {
    async function load() {
      const [c, p, s, e, inv] = await Promise.all([
        getCustomers(),
        getPayments(),
        getSales(),
        getExpenses(),
        getInventoryPurchases(),
      ]);
      setCustomers(c);
      setPayments(p);
      setSales(s);
      setExpenses(e);
      setPurchases(inv);
      setLoading(false);
    }
    load();
  }, []);

  const customerMap = useMemo(
    () => new Map<string, string>(customers.map((c) => [c.id, c.name])),
    [customers]
  );

  const allTransactions = useMemo((): Transaction[] => {
    const txs: Transaction[] = [];

    payments.forEach((p) => {
      txs.push({
        id: `p-${p.id}`,
        type: "payment",
        description: customerMap.get(p.customerId) ?? "عميل",
        amount: p.amount,
        date: normalizeDate(p.date),
      });
    });

    sales.forEach((s) => {
      txs.push({
        id: `s-${s.id}`,
        type: "sale",
        description: s.itemName,
        amount: s.sellPrice ?? s.price,
        date: normalizeDate(s.date),
      });
    });

    expenses.forEach((e) => {
      txs.push({
        id: `e-${e.id}`,
        type: "expense",
        description: e.expenseName,
        amount: -e.price,
        date: normalizeDate(e.date),
      });
    });

    purchases.forEach((p) => {
      txs.push({
        id: `inv-${p.id}`,
        type: "purchase",
        description: p.itemName,
        amount: -p.totalCost,
        date: normalizeDate(p.date),
      });
    });

    return txs;
  }, [payments, sales, expenses, purchases, customerMap]);

  const filtered = useMemo(
    () =>
      allTransactions
        .filter((tx) => tx.date >= fromDate && tx.date <= toDate)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [allTransactions, fromDate, toDate]
  );

  const totals = useMemo(() => {
    const income = filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const outgoing = filtered.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    return { income, outgoing, balance: income - outgoing };
  }, [filtered]);

  const allTimeBalance = useMemo(() => {
    const income = allTransactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const outgoing = allTransactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    return income - outgoing;
  }, [allTransactions]);

  return (
    <div className="min-h-full">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">الخزينة</h2>

        <div className={`rounded-2xl p-5 mb-6 ${allTimeBalance >= 0 ? "bg-green-50" : "bg-red-50"}`}>
          <p className={`text-sm font-medium mb-1 ${allTimeBalance >= 0 ? "text-green-700 opacity-75" : "text-red-700 opacity-75"}`}>
            الرصيد الكلي (منذ البداية)
          </p>
          <p className={`text-2xl font-bold ${allTimeBalance >= 0 ? "text-green-700" : "text-red-700"}`}>
            {allTimeBalance.toLocaleString()} جنيه
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="text-sm text-gray-500 font-medium">من</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          <span className="text-sm text-gray-500 font-medium">إلى</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
            <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-green-50 rounded-2xl p-4">
                <p className="text-xs font-medium text-green-700 opacity-75 mb-1">الوارد</p>
                <p className="text-lg font-bold text-green-700">{totals.income.toLocaleString()} جنيه</p>
              </div>
              <div className="bg-red-50 rounded-2xl p-4">
                <p className="text-xs font-medium text-red-700 opacity-75 mb-1">الصادر</p>
                <p className="text-lg font-bold text-red-700">{totals.outgoing.toLocaleString()} جنيه</p>
              </div>
              <div className={`rounded-2xl p-4 ${totals.balance >= 0 ? "bg-blue-50" : "bg-red-50"}`}>
                <p className={`text-xs font-medium opacity-75 mb-1 ${totals.balance >= 0 ? "text-blue-700" : "text-red-700"}`}>
                  صافي الفترة
                </p>
                <p className={`text-lg font-bold ${totals.balance >= 0 ? "text-blue-700" : "text-red-700"}`}>
                  {totals.balance.toLocaleString()} جنيه
                </p>
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-16">لا توجد معاملات في هذه الفترة.</p>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800 text-sm">كل المعاملات ({filtered.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-right">
                        <th className="px-4 py-3 font-semibold text-gray-600">النوع</th>
                        <th className="px-4 py-3 font-semibold text-gray-600">الوصف</th>
                        <th className="px-4 py-3 font-semibold text-gray-600">المبلغ</th>
                        <th className="px-4 py-3 font-semibold text-gray-600">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((tx) => (
                        <tr key={tx.id} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${TX_STYLES[tx.type]}`}>
                              {TX_LABELS[tx.type]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{tx.description}</td>
                          <td className={`px-4 py-3 font-semibold ${tx.amount >= 0 ? "text-green-700" : "text-red-600"}`}>
                            {tx.amount >= 0 ? "+" : ""}{tx.amount.toLocaleString()} جنيه
                          </td>
                          <td className="px-4 py-3 text-gray-600">{tx.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
