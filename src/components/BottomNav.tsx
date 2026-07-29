"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/practice", label: "Practice", icon: "✍️" },
  { href: "/progress", label: "Progress", icon: "📊" },
  { href: "/collections", label: "Bộ sưu tập", icon: "📚" },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-md flex">
        {TABS.map((t) => {
          const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 flex flex-col items-center py-2 text-xs ${
                active ? "text-blue-600 font-semibold" : "text-gray-500"
              }`}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              <span className="mt-1">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
