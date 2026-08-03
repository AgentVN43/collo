"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Nội dung", icon: "📝" },
  { href: "/admin/ai", label: "AI Center", icon: "🤖" },
  { href: "/admin/feedbacks", label: "Feedbacks", icon: "💬" },
];

export default function AdminBottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin" ||
        pathname.startsWith("/admin/word") ||
        pathname.startsWith("/admin/collocation")
      : pathname.startsWith(href);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 flex flex-col items-center py-2 text-xs ${
              isActive(t.href) ? "text-blue-600 font-semibold" : "text-gray-500"
            }`}
          >
            <span className="text-xl leading-none">{t.icon}</span>
            <span className="mt-1">{t.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
