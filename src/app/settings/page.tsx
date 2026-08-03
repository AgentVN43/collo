"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { isAdmin } from "@/lib/admin";
import {
  clampQuantity,
  getEnabledCategories,
  getPracticeSettings,
  setEnabledCategories,
  setPracticeSettings,
  type PracticeSettings,
} from "@/lib/settings";
import type { Category } from "@/lib/types";

/** Toggle switch bật/tắt một category — pattern checkbox + peer chuẩn Tailwind. */
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <label className="relative inline-flex shrink-0 cursor-pointer items-center">
      <input type="checkbox" checked={on} onChange={onChange} className="peer sr-only" />
      <span className="h-7 w-12 rounded-full bg-gray-300 transition-colors peer-checked:bg-blue-600 after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { session } = useSession();
  const supabase = getSupabase();
  const [categories, setCategories] = useState<Category[]>([]);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [practice, setPractice] = useState<PracticeSettings | null>(null);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("categories")
      .select("*")
      .order("sort_order")
      .then(({ data }) => {
        const cats = (data as Category[]) ?? [];
        setCategories(cats);
        setEnabled(getEnabledCategories(cats.map((c) => c.slug)));
      });
    setPractice(getPracticeSettings());
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !session) {
      setAdmin(false);
      return;
    }
    isAdmin(supabase).then(setAdmin);
  }, [supabase, session]);

  const updatePractice = (patch: Partial<PracticeSettings>) => {
    if (!practice) return;
    const next = { ...practice, ...patch };
    setPractice(next);
    setPracticeSettings(next);
  };

  const toggleCategory = (slug: string) => {
    const next = enabled.includes(slug) ? enabled.filter((x) => x !== slug) : [...enabled, slug];
    if (next.length === 0) return; // luôn giữ ít nhất 1 category bật
    setEnabled(next);
    setEnabledCategories(next);
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    router.push("/");
  };

  return (
    <div>
      <TopBar title="Settings" back />
      <div className="px-4 py-4 space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-500 mb-1">
            What language do you speak?
          </label>
          <select
            className="w-full rounded-xl border border-gray-300 px-4 py-3 bg-white"
            defaultValue="vi"
            disabled
          >
            <option value="vi">Tiếng Việt</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-500 mb-1">
            What language do you need to learn?
          </label>
          <select
            className="w-full rounded-xl border border-gray-300 px-4 py-3 bg-white"
            defaultValue="en"
            disabled
          >
            <option value="en">Tiếng Anh</option>
          </select>
          <p className="mt-1 text-xs text-gray-400">
            Các ngôn ngữ khác sẽ được bổ sung ở phiên bản sau.
          </p>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-1">Luyện tập</h2>
          {practice && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Số mục mỗi phiên luyện</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={practice.quantity}
                  onChange={(e) => updatePractice({ quantity: clampQuantity(Number(e.target.value)) })}
                  className="w-24 rounded-xl border border-gray-300 px-3 py-2 text-center outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">Chế độ luyện tập</label>
                <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                  <button
                    onClick={() => updatePractice({ mode: "free" })}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                  >
                    <span
                      className={`h-5 w-5 shrink-0 rounded-full border-2 ${
                        practice.mode === "free" ? "border-blue-600 bg-blue-600 ring-2 ring-inset ring-white" : "border-gray-300"
                      }`}
                    />
                    <span>
                      <span className="block font-medium text-gray-900">Free practice</span>
                      <span className="text-xs text-gray-500">Random từ toàn bộ kho theo lịch ôn</span>
                    </span>
                  </button>
                  <button
                    onClick={() => updatePractice({ mode: "collection" })}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                  >
                    <span
                      className={`h-5 w-5 shrink-0 rounded-full border-2 ${
                        practice.mode === "collection" ? "border-blue-600 bg-blue-600 ring-2 ring-inset ring-white" : "border-gray-300"
                      }`}
                    />
                    <span>
                      <span className="block font-medium text-gray-900">Optional practice</span>
                      <span className="text-xs text-gray-500">Chọn bộ sưu tập trước mỗi phiên luyện</span>
                    </span>
                  </button>
                </div>
                {practice.mode === "collection" && (
                  <p className="mt-1.5 text-xs text-amber-600">
                    Hãy nhớ tạo list học tập trước khi luyện tập nhé 📚
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-1">Category to Practice</h2>
          <p className="text-xs text-gray-400 mb-3">
            Chọn các loại collocation muốn rèn luyện — áp dụng cho Level 2 (luyện collocation). Level 1
            (từ đơn) không lọc theo category. Lưu theo thiết bị.
          </p>
          <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
            {categories.map((c) => (
              <div key={c.slug} className="flex items-center justify-between px-3 py-2.5">
                <span className="text-gray-800">{c.name}</span>
                <Toggle on={enabled.includes(c.slug)} onChange={() => toggleCategory(c.slug)} />
              </div>
            ))}
            {categories.length === 0 && (
              <p className="px-3 py-2.5 text-sm text-gray-400">Chưa có category nào.</p>
            )}
          </div>
        </div>

        {admin && (
          <div className="border-t border-gray-100 pt-4">
            <h2 className="text-sm font-semibold text-gray-500 mb-2">Quản trị</h2>
            <Link
              href="/admin"
              className="block w-full rounded-xl border border-purple-300 bg-purple-50 py-3 text-center font-semibold text-purple-700"
            >
              🛠 Admin Dashboard — Quản lý từ vựng
            </Link>
          </div>
        )}

        <div className="border-t border-gray-100 pt-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">Tài khoản</h2>
          {session ? (
            <div className="space-y-3">
              <p className="text-gray-800">{session.user.email}</p>
              <button
                onClick={signOut}
                className="w-full rounded-xl border border-red-200 py-3 text-red-600 font-semibold"
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            <Link
              href="/login?next=/settings"
              className="block w-full rounded-xl bg-blue-600 py-3 text-center text-white font-semibold"
            >
              Đăng nhập / Đăng ký
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
