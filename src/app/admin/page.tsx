"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import {
  adminCreateContent,
  adminListContent,
  adminStatusCounts,
  type AdminContentRow,
  type ContentTable,
} from "@/lib/admin";
import { STATUS_LABELS, WORD_STATUSES, type WordStatus } from "@/lib/types";

const STATUS_BADGE: Record<WordStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  processing: "bg-yellow-100 text-yellow-700",
  published: "bg-green-100 text-green-700",
  archived: "bg-red-50 text-red-500",
};

const TABLE_META: Record<ContentTable, { label: string; placeholder: string; detail: string }> = {
  words: { label: "Từ đơn", placeholder: "Thêm từ đơn mới…", detail: "/admin/word" },
  collocations: {
    label: "Collocation",
    placeholder: "Thêm cụm từ mới…",
    detail: "/admin/collocation",
  },
};

export default function AdminPage() {
  const supabase = getSupabase();
  const [table, setTable] = useState<ContentTable>("words");
  const [tab, setTab] = useState<WordStatus>("draft");
  const [counts, setCounts] = useState<Record<WordStatus, number> | null>(null);
  const [rows, setRows] = useState<AdminContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    setLoading(true);
    Promise.all([adminListContent(supabase, table, tab), adminStatusCounts(supabase, table)]).then(
      ([list, c]) => {
        setRows(list);
        setCounts(c);
        setLoading(false);
      }
    );
  }, [supabase, table, tab]);

  const create = async () => {
    if (!supabase || !newLabel.trim()) return;
    setCreateError(null);
    const result = await adminCreateContent(supabase, table, newLabel);
    if ("error" in result) {
      setCreateError(result.error);
      return;
    }
    setNewLabel("");
    setTab("draft");
    const [list, c] = await Promise.all([
      adminListContent(supabase, table, "draft"),
      adminStatusCounts(supabase, table),
    ]);
    setRows(list);
    setCounts(c);
  };

  const meta = TABLE_META[table];

  return (
    <div>
      <div className="space-y-4 px-4 py-4 md:px-6">
        <h1 className="text-xl font-bold text-gray-900">Quản lý nội dung</h1>

        {/* Chọn bảng nội dung */}
        <div className="flex border-b border-gray-200">
          {(Object.keys(TABLE_META) as ContentTable[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTable(t);
                setCreateError(null);
                setNewLabel("");
              }}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                table === t ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-400"
              }`}
            >
              {TABLE_META[t].label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder={meta.placeholder}
            autoCapitalize="none"
            className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-blue-500"
          />
          <button
            onClick={create}
            disabled={!newLabel.trim()}
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
            Không có mục nào ở trạng thái “{STATUS_LABELS[tab]}”.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`${meta.detail}/${r.id}`} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-gray-900">{r.label}</span>
                    <span className="block truncate text-sm text-gray-500">
                      {r.meaning || "— chưa có nghĩa —"}
                    </span>
                  </span>
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
