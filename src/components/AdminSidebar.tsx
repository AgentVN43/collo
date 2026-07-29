"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Từ vựng", icon: "📝" },
  { href: "/admin/ai", label: "AI Center", icon: "🤖" },
  { href: "/admin/feedbacks", label: "Feedbacks", icon: "💬" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin" || pathname.startsWith("/admin/word")
      : pathname.startsWith(href);

  return (
    <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 bg-white border-r border-gray-200 min-h-screen">
      <div className="px-4 py-5">
        <Link href="/admin" className="text-lg font-bold text-gray-900">
          Folask Admin
        </Link>
      </div>
      <nav className="flex-1 px-2 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive(item.href)
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="px-2 pb-4">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900"
        >
          <span className="text-lg">←</span>
          Về ứng dụng
        </Link>
      </div>
    </aside>
  );
}
