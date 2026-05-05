"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

const links = [
  { href: "/dashboard", label: "الرئيسية" },
  { href: "/students", label: "الطلاب" },
  { href: "/employees", label: "الموظفين" },
  { href: "/expenses", label: "المصاريف" },
  { href: "/reports", label: "التقارير" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await signOut(auth);
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-10">
      {/* Black top bar */}
      <div className="bg-[#1a1a2e] h-12 flex items-center px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <span className="text-white font-bold text-base tracking-wide">Mr Kids</span>
        </div>
      </div>

      {/* Blue nav bar */}
      <div className="bg-[#1976d2]">
        <div className="flex items-center px-6 h-10">
          {/* Desktop links */}
          <nav className="hidden sm:flex items-center gap-1 flex-1">
            {links.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                    active ? "bg-white/20 text-white" : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Mobile: subtitle + hamburger */}
          <span className="sm:hidden text-white/80 text-xs font-medium flex-1">نظام إدارة الحضانة</span>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="sm:hidden p-1.5 rounded text-white/80 hover:text-white hover:bg-white/10 transition"
            aria-label="القائمة"
          >
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          {/* Desktop logout */}
          <button
            onClick={handleLogout}
            className="hidden sm:block text-white/80 hover:text-white text-sm font-medium transition px-3 py-1.5 rounded hover:bg-white/10"
          >
            خروج
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="sm:hidden border-t border-white/20 bg-[#1565c0] px-4 py-3 space-y-1">
            {links.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded text-sm font-medium transition ${
                    active ? "bg-white/20 text-white" : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="block w-full text-right px-3 py-2.5 rounded text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition"
            >
              خروج
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
