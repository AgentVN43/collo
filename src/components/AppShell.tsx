"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  return (
    <>
      <div className="mx-auto max-w-md min-h-screen bg-white shadow-sm pb-24">{children}</div>
      <BottomNav />
    </>
  );
}
