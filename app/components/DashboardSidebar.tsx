
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const menu = [
  { label: "Dashboard", href: "/" },
  { label: "My Channels", href: "/channels" },
  { label: "Analytics", href: "/analytics" },
  { label: "Comparison", href: "/comparison" },
  { label: "Reports", href: "/reports" },
  { label: "Settings", href: "/settings" },
  { label: "Billing", href: "/billing" },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [mobileOpen]);

  const navigation = (
    <nav className="space-y-2" aria-label="Workspace navigation">
      {menu.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileOpen(false)}
          aria-current={pathname === item.href ? "page" : undefined}
          className={`block rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
            pathname === item.href
              ? "bg-blue-600 text-white"
              : "text-slate-400 hover:bg-white/5 hover:text-white"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );

  const branding = (
    <div className="mb-10">
      <h1 className="text-xl font-bold tracking-tight">
        Creator<span className="text-blue-500">Command</span>
      </h1>
      <p className="mt-1 text-xs text-slate-500">
        CREATOR CONTROL CENTER
      </p>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-[#0d1424] p-6 md:block">
        <div className="sticky top-6">
          {branding}
          {navigation}
        </div>
      </aside>

      {/* Mobile top navigation */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-[#0d1424] px-4 md:hidden">
        <div>
          <p className="text-base font-bold tracking-tight">
            Creator<span className="text-blue-500">Command</span>
          </p>
          <p className="text-[10px] text-slate-500">
            CREATOR CONTROL CENTER
          </p>
        </div>

        <button
          type="button"
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-workspace-navigation"
          onClick={() => setMobileOpen(true)}
          className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-white"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/70"
          />

          <aside
            id="mobile-workspace-navigation"
            aria-label="Mobile workspace navigation"
            className="absolute inset-y-0 left-0 w-[min(85vw,300px)] overflow-y-auto border-r border-white/10 bg-[#0d1424] p-6 shadow-2xl"
          >
            <div className="mb-8 flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold">
                  Creator<span className="text-blue-500">Command</span>
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  CREATOR CONTROL CENTER
                </p>
              </div>

              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg border border-white/10 p-2 text-slate-300"
              >
                ✕
              </button>
            </div>

            {navigation}
          </aside>
        </div>
      )}
    </>
  );
}
