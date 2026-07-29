"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { isAdmin } from "@/lib/admin";
import AdminSidebar from "@/components/AdminSidebar";
import AdminBottomNav from "@/components/AdminBottomNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId, loading: authLoading } = useSession();
  const supabase = getSupabase();
  const [admin, setAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabase || !userId) {
      if (!authLoading) setAdmin(false);
      return;
    }
    isAdmin(supabase).then(setAdmin);
  }, [supabase, userId, authLoading]);

  if (authLoading || admin === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Đang tải…</p>
      </div>
    );
  }

  if (!userId || !admin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Khu vực này chỉ dành cho quản trị viên.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 min-w-0 pb-20 md:pb-0">{children}</main>
      <AdminBottomNav />
    </div>
  );
}
