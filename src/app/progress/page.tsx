"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import type { ProgressRow, Word } from "@/lib/types";

function MasteryBar({ mastery }: { mastery: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-2 w-3 rounded-sm ${
            i <= mastery ? (mastery >= 4 ? "bg-green-500" : "bg-yellow-400") : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

interface WordProgress {
  word: Word;
  rows: ProgressRow[];
  avgMastery: number;
  isSolid: boolean;
  accuracy: number;
}

function TrendArrow({ wp }: { wp: WordProgress }) {
  if (wp.isSolid)
    return <span className="text-green-500 text-lg">★</span>;
  if (wp.accuracy >= 0.7)
    return <span className="text-green-500 font-bold">↑</span>;
  if (wp.accuracy < 0.5)
    return <span className="text-red-500 font-bold">↓</span>;
  return <span className="text-gray-400">→</span>;
}

function WordCard({
  wp,
  isExpanded,
  onToggle,
}: {
  wp: WordProgress;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <TrendArrow wp={wp} />
        <span className="flex-1 font-bold text-gray-900 truncate">
          {wp.word.word}
        </span>
        <span className="text-sm font-semibold text-gray-600">
          {wp.avgMastery.toFixed(1)}
        </span>
        <MasteryBar mastery={Math.round(wp.avgMastery)} />
        <svg
          className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">{wp.word.meaning_vi}</span>
            <Link
              href={`/practice?word=${wp.word.id}`}
              className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
            >
              Luyện
            </Link>
          </div>
          {wp.word.partnerships.map((p) => {
            const row = wp.rows.find((r) => r.partnership_key === p.key);
            const mastery = row?.mastery ?? 0;
            return (
              <div key={p.key} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 truncate text-gray-600">
                  {p.phrase}
                </span>
                <MasteryBar mastery={mastery} />
                <span className="ml-auto text-xs font-medium text-gray-500">
                  {mastery}/5
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ProgressPage() {
  const { userId, loading: authLoading } = useSession();
  const [words, setWords] = useState<Word[]>([]);
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"learning" | "mastered">("learning");
  const [sortBy, setSortBy] = useState<"accuracy" | "mastery" | "alpha">("accuracy");
  const supabase = getSupabase();

  useEffect(() => {
    if (!supabase || !userId) {
      if (!authLoading) setLoading(false);
      return;
    }
    Promise.all([
      supabase.from("words").select("*"),
      supabase.from("progress").select("*"),
    ]).then(([w, p]) => {
      setWords((w.data as Word[]) ?? []);
      setRows((p.data as ProgressRow[]) ?? []);
      setLoading(false);
    });
  }, [supabase, userId, authLoading]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const { practicedCount, solidCount, notSolid, solid } = useMemo(() => {
    const l2 = rows.filter((r) => r.level === 2);
    const byWord = new Map<string, ProgressRow[]>();
    for (const r of l2) {
      if (r.attempts === 0) continue;
      const list = byWord.get(r.word_id) ?? [];
      list.push(r);
      byWord.set(r.word_id, list);
    }

    const practiced: WordProgress[] = [];
    for (const w of words) {
      const mine = byWord.get(w.id);
      if (!mine) continue;
      const keys = w.partnerships.map((p) => p.key);
      const avgMastery =
        mine.reduce((s, r) => s + r.mastery, 0) / mine.length;
      const isSolid = keys.every(
        (k) => (mine.find((r) => r.partnership_key === k)?.mastery ?? 0) >= 4
      );
      const attempts = mine.reduce((s, r) => s + r.attempts, 0);
      const fails = mine.reduce((s, r) => s + r.fails, 0);
      const near = mine.reduce((s, r) => s + r.near_misses, 0);
      const accuracy =
        attempts > 0 ? (attempts - fails - near + near * 0.5) / attempts : 0;
      practiced.push({ word: w, rows: mine, avgMastery, isSolid, accuracy });
    }

    const sorter = (a: WordProgress, b: WordProgress) => {
      if (sortBy === "accuracy") return a.accuracy - b.accuracy;
      if (sortBy === "mastery") return a.avgMastery - b.avgMastery;
      return a.word.word.localeCompare(b.word.word);
    };

    const notSolid = practiced.filter((p) => !p.isSolid).sort(sorter);
    const solid = practiced.filter((p) => p.isSolid).sort(sorter);

    return {
      practicedCount: practiced.length,
      solidCount: solid.length,
      notSolid,
      solid,
    };
  }, [rows, words, sortBy]);

  return (
    <div>
      <TopBar title="Progress" />
      {authLoading || loading ? (
        <p className="p-6 text-center text-gray-400">Đang tải…</p>
      ) : !userId ? (
        <div className="p-6 text-center space-y-3">
          <p className="text-gray-600">
            Đăng nhập để xem tiến độ học của bạn.
          </p>
          <Link
            href="/login?next=/progress"
            className="inline-block rounded-xl bg-blue-600 px-6 py-2.5 text-white font-semibold"
          >
            Đăng nhập
          </Link>
        </div>
      ) : practicedCount === 0 ? (
        <div className="p-6 text-center space-y-3">
          <p className="text-gray-500">
            Chưa có dữ liệu — luyện từ đầu tiên để bắt đầu theo dõi tiến độ.
          </p>
          <Link
            href="/practice"
            className="inline-block rounded-xl bg-blue-600 px-6 py-2.5 text-white font-semibold"
          >
            Luyện ngay
          </Link>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-green-50 p-4 text-center">
              <p className="text-3xl font-bold text-green-700">{solidCount}</p>
              <p className="text-sm text-gray-600">Thành thạo</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-4 text-center">
              <p className="text-3xl font-bold text-blue-700">
                {practicedCount}
              </p>
              <p className="text-sm text-gray-600">Bắt đầu học</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setTab("learning")}
              className={`flex-1 py-2.5 text-sm font-semibold text-center transition-colors ${
                tab === "learning"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-400"
              }`}
            >
              Đang học ({notSolid.length})
            </button>
            <button
              onClick={() => setTab("mastered")}
              className={`flex-1 py-2.5 text-sm font-semibold text-center transition-colors ${
                tab === "mastered"
                  ? "text-green-600 border-b-2 border-green-600"
                  : "text-gray-400"
              }`}
            >
              Thành thạo ({solid.length})
            </button>
          </div>

          {/* Tab content */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase">
                {tab === "learning"
                  ? `Đang học (${notSolid.length})`
                  : `Thành thạo (${solid.length})`}
              </h2>
              <div className="flex items-center gap-1.5">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "accuracy" | "mastery" | "alpha")}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600"
                >
                  <option value="accuracy">Accuracy</option>
                  <option value="mastery">Mastery</option>
                  <option value="alpha">A → Z</option>
                </select>
              </div>
            </div>

            {(tab === "learning" ? notSolid : solid).length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-6">
                {tab === "learning"
                  ? "Tất cả từ đã thành thạo!"
                  : "Chưa có từ nào thành thạo."}
              </p>
            ) : (
              <div className="space-y-2">
                {(tab === "learning" ? notSolid : solid).map((wp) => (
                  <WordCard
                    key={wp.word.id}
                    wp={wp}
                    isExpanded={expanded.has(wp.word.id)}
                    onToggle={() => toggle(wp.word.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
