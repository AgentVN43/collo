"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import {
  adminCreateWord,
  adminListWords,
  adminStatusCounts,
  type AdminWordRow,
} from "@/lib/admin";
import { STATUS_LABELS, WORD_STATUSES, type WordStatus } from "@/lib/types";

const STATUS_BADGE: Record<WordStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  processing: "bg-yellow-100 text-yellow-700",
  published: "bg-green-100 text-green-700",
  archived: "bg-red-50 text-red-500",
};

export default function AdminPage() {
  const supabase = getSupabase();
  const [tab, setTab] = useState<WordStatus>("draft");
  const [counts, setCounts] = useState<Record<WordStatus, number> | null>(null);
  const [rows, setRows] = useState<AdminWordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWord, setNewWord] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    setLoading(true);
    Promise.all([adminListWords(supabase, tab), adminStatusCounts(supabase)]).then(([list, c]) => {
      setRows(list);
      setCounts(c);
      setLoading(false);
    });
  }, [supabase, tab]);

  const create = async () => {
    if (!supabase || !newWord.trim()) return;
    setCreateError(null);
    const result = await adminCreateWord(supabase, newWord);
    if ("error" in result) {
      setCreateError(result.error);
      return;
    }
    setNewWord("");
    setTab("draft");
    const [list, c] = await Promise.all([adminListWords(supabase, "draft"), adminStatusCounts(supabase)]);
    setRows(list);
    setCounts(c);
  };

  return (
    <div>
      <div className="px-4 md:px-6 py-4 space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Quản lý từ vựng</h1>
        <div className="flex gap-2">
          <input
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Thêm từ mới (nguyên mẫu)…"
            autoCapitalize="none"
            className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-blue-500"
          />
          <button
            onClick={create}
            disabled={!newWord.trim()}
            className="rounded-xl bg-blue-600 px-4 font-semibold text-white disabled:opacity-50"
          >
            ＋ Tạo
          </button>
        </div>
        {createError && <p className="text-sm text-red-600">{createError}</p>}

        {/* Tabs theo status */}
        <div className="flex gap-1.5 overflow-x-auto">
          {WORD_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
                tab === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {STATUS_LABELS[s]}
              {counts ? ` (${counts[s]})` : ""}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-6 text-center text-gray-400">Đang tải…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            Không có từ nào ở trạng thái “{STATUS_LABELS[tab]}”.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/word/${r.id}`} className="flex items-center gap-3 py-3">
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-semibold text-gray-900">{r.word}</span>
                    <span className="block truncate text-sm text-gray-500">
                      {r.meaning_vi || "— chưa có nghĩa —"}
                    </span>
                  </span>
                  {r.category_slug && (
                    <span className="shrink-0 text-xs text-gray-400">{r.category_slug}</span>
                  )}
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status]}`}
                  >
                    {STATUS_LABELS[r.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
