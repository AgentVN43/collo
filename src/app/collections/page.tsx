"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { createCollection, fetchCollections, type CollectionWithCount } from "@/lib/collections";

export default function CollectionsPage() {
  const { userId, loading: authLoading } = useSession();
  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const supabase = getSupabase();

  useEffect(() => {
    if (!supabase || !userId) {
      if (!authLoading) setLoading(false);
      return;
    }
    fetchCollections(supabase).then((cols) => {
      setCollections(cols);
      setLoading(false);
    });
  }, [supabase, userId, authLoading]);

  const create = async () => {
    if (!supabase || !userId || !newName.trim()) return;
    const col = await createCollection(supabase, userId, newName);
    if (col) {
      setCollections([{ ...col, word_count: 0 }, ...collections]);
      setNewName("");
      setCreating(false);
    }
  };

  return (
    <div>
      <TopBar title="Bộ sưu tập" />
      {authLoading || loading ? (
        <p className="p-6 text-center text-gray-400">Đang tải…</p>
      ) : !userId ? (
        <div className="p-6 text-center space-y-3">
          <p className="text-gray-600">Đăng nhập để tạo bộ sưu tập từ vựng của bạn.</p>
          <Link
            href="/login?next=/collections"
            className="inline-block rounded-xl bg-blue-600 px-6 py-2.5 text-white font-semibold"
          >
            Đăng nhập
          </Link>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          <button
            onClick={() => setCreating(!creating)}
            className="w-full rounded-xl border-2 border-dashed border-gray-300 py-3 font-semibold text-gray-600"
          >
            ＋ Tạo bộ sưu tập mới
          </button>
          {creating && (
            <div className="rounded-xl border border-gray-200 p-3 space-y-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="Tên bộ sưu tập"
                autoFocus
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500"
              />
              <div className="flex items-center justify-between opacity-50">
                <span className="text-sm text-gray-700">Bộ sưu tập công khai</span>
                <span className="text-xs text-gray-400">Sắp ra mắt</span>
              </div>
              <div className="flex items-center justify-between opacity-50">
                <span className="text-sm text-gray-700">Thêm người đóng góp</span>
                <span className="text-xs text-gray-400">Sắp ra mắt</span>
              </div>
              <button
                onClick={create}
                disabled={!newName.trim()}
                className="w-full rounded-xl bg-blue-600 py-2.5 font-semibold text-white disabled:opacity-50"
              >
                Tạo
              </button>
            </div>
          )}

          {collections.length === 0 && !creating ? (
            <p className="py-8 text-center text-sm text-gray-500">
              Chưa có bộ sưu tập nào. Tạo một bộ rồi bấm 🔖 ở Home để thêm từ vào.
            </p>
          ) : (
            <ul className="space-y-2">
              {collections.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/collections/${c.id}`}
                    className="flex items-center rounded-xl border border-gray-200 px-4 py-3"
                  >
                    <span className="mr-3 text-2xl">📚</span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate font-semibold text-gray-900">{c.name}</span>
                      <span className="text-xs text-gray-400">{c.word_count} từ</span>
                    </span>
                    <span className="text-gray-300">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
