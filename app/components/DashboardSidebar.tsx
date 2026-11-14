
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

  return (
    <aside className="w-64 shrink-0 border-r border-white/10 bg-[#0d1424] p-6">
      <div className="mb-10">
        <h1 className="text-xl font-bold">
          Creator<span className="text-blue-500">Command</span>
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          CREATOR CONTROL CENTER
        </p>
      </div>

      <nav className="space-y-2">
        {menu.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-xl px-4 py-3 text-sm ${
              pathname === item.href
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

