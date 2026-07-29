"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  type FeedbackCategory,
  type FeedbackStatus,
} from "@/lib/types";

interface FeedbackRow {
  id: string;
  word_id: string;
  user_id: string;
  category: FeedbackCategory;
  content: string;
  status: FeedbackStatus;
  created_at: string;
  word: { word: string } | null;
}

const STATUS_BADGE: Record<FeedbackStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  wip: "bg-yellow-100 text-yellow-700",
  done: "bg-green-100 text-green-700",
};

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: "Mới",
  wip: "Đang xử lý",
  done: "Đã xong",
};

const CATEGORY_LABEL: Record<FeedbackCategory, string> = Object.fromEntries(
  FEEDBACK_CATEGORIES.map((c) => [c.value, c.label])
) as Record<FeedbackCategory, string>;

export default function AdminFeedbacksPage() {
  const supabase = getSupabase();
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FeedbackStatus | "all">("all");

  const load = async () => {
    if (!supabase) return;
    setLoading(true);
    let q = supabase
      .from("feedbacks")
      .select("*, word:words(word)")
      .order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setRows((data as FeedbackRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [supabase, filter]);

  const updateStatus = async (id: string, status: FeedbackStatus) => {
    if (!supabase) return;
    await supabase.from("feedbacks").update({ status }).eq("id", id);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  return (
    <div>
      <div className="px-4 md:px-6 py-4 space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Feedbacks</h1>

        <div className="flex gap-1.5 overflow-x-auto">
          <button
            onClick={() => setFilter("all")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === "all" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            Tất cả
          </button>
          {FEEDBACK_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
                filter === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-6 text-center text-gray-400">Đang tải…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">Không có feedback nào.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-gray-200 p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/admin/word/${r.word_id}`}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    {r.word?.word ?? r.word_id}
                  </Link>
                  <span className="rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs text-purple-700">
                    {CATEGORY_LABEL[r.category]}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                  <span className="ml-auto text-xs text-gray-400">
                    {new Date(r.created_at).toLocaleString("vi")}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{r.content}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">User: {r.user_id.slice(0, 8)}…</span>
                  <div className="ml-auto flex gap-1">
                    {FEEDBACK_STATUSES.filter((s) => s !== r.status).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(r.id, s)}
                        className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        → {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
