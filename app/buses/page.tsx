"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
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
}

// ─── Constants ───────────────────────────────────────────────────────────────

const AREAS = ["عربية عم سعيد", "عربية أبو الشيخ", "توكتوك العرب"] as const;
type Area = (typeof AREAS)[number];

// ─── Firestore helpers ────────────────────────────────────────────────────────

async function fetchStudents(): Promise<Student[]> {
  const snap = await getDocs(collection(db, "students"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student));
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BusesPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [students, setStudents]       = useState<Student[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeArea, setActiveArea]   = useState<Area>("عربية عم سعيد");

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) router.replace("/");
      else setAuthChecked(true);
    });
    return () => unsub();
  }, [router]);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authChecked) return;
    fetchStudents().then((s) => {
      setStudents(s);
      setLoading(false);
    });
  }, [authChecked]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const busByArea = useMemo(() => {
    const map: Record<Area, Student[]> = {
      "عربية عم سعيد": [],
      "عربية أبو الشيخ": [],
      "توكتوك العرب": [],
    };
    for (const s of students) {
      if (s.type === "bus" && s.status === "active" && s.area in map) {
        map[s.area as Area].push(s);
      }
    }
    return map;
  }, [students]);

  const tabStudents = busByArea[activeArea];

  const tabTotals = useMemo(() => ({
    busAmount:       tabStudents.reduce((s, st) => s + (st.busAmount || 0), 0),
    paidAmount:      tabStudents.reduce((s, st) => s + (st.paidAmount || 0), 0),
    remainingAmount: tabStudents.reduce((s, st) => s + (st.remainingAmount || 0), 0),
  }), [tabStudents]);

  // ── Loading / auth spinner ─────────────────────────────────────────────────
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">العربيات</h2>
          <p className="text-sm text-gray-500 mt-0.5">طلاب العربيات مقسمين حسب المنطقة</p>
        </div>

        {/* ── Summary cards ───────────────────────────────────────────────── */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {AREAS.map((area) => {
              const count = busByArea[area].length;
              const total = busByArea[area].reduce((s, st) => s + (st.busAmount || 0), 0);
              const isActive = area === activeArea;
              return (
                <button
                  key={area}
                  onClick={() => setActiveArea(area)}
                  className={`rounded-2xl p-4 text-right transition border-2 ${
                    isActive
                      ? "bg-[#1976d2] border-[#1976d2] text-white shadow-md"
                      : "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  <p className={`text-xs font-medium mb-1 ${isActive ? "text-blue-100" : "text-gray-500"}`}>
                    {area}
                  </p>
                  <p className={`text-2xl font-bold ${isActive ? "text-white" : "text-gray-900"}`}>
                    {count}
                  </p>
                  <p className={`text-xs mt-1 ${isActive ? "text-blue-100" : "text-gray-400"}`}>
                    {total.toLocaleString()} ج إجمالي
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit">
          {AREAS.map((area) => (
            <button
              key={area}
              onClick={() => setActiveArea(area)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                activeArea === area
                  ? "bg-white text-[#1976d2] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {area}
              <span className={`mr-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                activeArea === area ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-500"
              }`}>
                {busByArea[area].length}
              </span>
            </button>
          ))}
        </div>

        {/* ── Table ───────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-xl h-14 animate-pulse" />
            ))}
          </div>
        ) : tabStudents.length === 0 ? (
          <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-200">
            <svg className="w-14 h-14 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <p className="text-sm font-medium">لا يوجد طلاب في منطقة {activeArea}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-right">
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">#</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">الاسم</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">الهاتف</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">اشتراك العربية</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">المدفوع</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">الباقي</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">تواصل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tabStudents.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {s.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap" dir="ltr">
                        {s.phone || "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-blue-700 whitespace-nowrap">
                        {(s.busAmount || 0).toLocaleString()} ج
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-medium text-green-700">
                          {(s.paidAmount || 0).toLocaleString()} ج
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {s.remainingAmount > 0 ? (
                          <span className="font-semibold text-orange-600">
                            {s.remainingAmount.toLocaleString()} ج
                          </span>
                        ) : (
                          <span className="text-green-600 font-semibold text-xs">مكتمل ✓</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <a
                          href={`https://wa.me/2${s.phone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.096.539 4.063 1.479 5.772L0 24l6.404-1.456A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.032-1.388l-.36-.214-3.735.849.875-3.633-.235-.374A9.818 9.818 0 012.182 12C2.182 6.573 6.573 2.182 12 2.182S21.818 6.573 21.818 12 17.427 21.818 12 21.818z" />
                          </svg>
                          واتساب
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-blue-50 text-xs font-semibold">
                    <td className="px-4 py-3 text-gray-600" colSpan={3}>
                      الإجمالي ({tabStudents.length} طالب)
                    </td>
                    <td className="px-4 py-3 text-blue-700">
                      {tabTotals.busAmount.toLocaleString()} ج
                    </td>
                    <td className="px-4 py-3 text-green-700">
                      {tabTotals.paidAmount.toLocaleString()} ج
                    </td>
                    <td className="px-4 py-3 text-orange-700">
                      {tabTotals.remainingAmount.toLocaleString()} ج
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
