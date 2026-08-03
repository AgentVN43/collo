"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { fetchWords } from "@/lib/words";
import { fetchCollocations } from "@/lib/collocations";
import { SOLID_THRESHOLD } from "@/lib/progress";
import type { Collocation, ProgressItemType, ProgressRow, Word } from "@/lib/types";

function MasteryBar({ mastery }: { mastery: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-2 w-3 rounded-sm ${
            i <= mastery ? (mastery >= SOLID_THRESHOLD ? "bg-green-500" : "bg-yellow-400") : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

interface ItemProgress {
  id: string;
  itemType: ProgressItemType;
  title: string;
  subtitle: string;
  mastery: number;
  accuracy: number;
  isSolid: boolean;
}

function TrendArrow({ ip }: { ip: ItemProgress }) {
  if (ip.isSolid) return <span className="text-lg text-green-500">★</span>;
  if (ip.accuracy >= 0.7) return <span className="font-bold text-green-500">↑</span>;
  if (ip.accuracy < 0.5) return <span className="font-bold text-red-500">↓</span>;
  return <span className="text-gray-400">→</span>;
}

function ItemCard({ ip }: { ip: ItemProgress }) {
  const href = ip.itemType === "word" ? `/word/${ip.id}` : `/collocation/${ip.id}`;
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5"
    >
      <TrendArrow ip={ip} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold text-gray-900">{ip.title}</span>
        <span className="block truncate text-xs text-gray-500">{ip.subtitle}</span>
      </span>
      <span className="text-sm font-semibold text-gray-600">{ip.mastery}</span>
      <MasteryBar mastery={ip.mastery} />
    </Link>
  );
}

export default function ProgressPage() {
  const { userId, loading: authLoading } = useSession();
  const [words, setWords] = useState<Word[]>([]);
  const [collocations, setCollocations] = useState<Collocation[]>([]);
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ProgressItemType>("word");
  const [sortBy, setSortBy] = useState<"accuracy" | "mastery" | "alpha">("accuracy");
  const supabase = getSupabase();

  useEffect(() => {
    if (!supabase || !userId) {
      if (!authLoading) setLoading(false);
      return;
    }
    Promise.all([
      fetchWords(supabase),
      fetchCollocations(supabase),
      supabase.from("progress").select("*"),
    ]).then(([w, c, p]) => {
      setWords(w);
      setCollocations(c);
      setRows((p.data as ProgressRow[]) ?? []);
      setLoading(false);
    });
  }, [supabase, userId, authLoading]);

  const { wordItems, collocationItems } = useMemo(() => {
    const build = (
      itemType: ProgressItemType,
      source: { id: string; title: string; subtitle: string }[]
    ): ItemProgress[] => {
      const out: ItemProgress[] = [];
      for (const s of source) {
        const row = rows.find((r) => r.item_type === itemType && r.item_id === s.id);
        if (!row || row.attempts === 0) continue;
        const accuracy =
          row.attempts > 0
            ? (row.attempts - row.fails - row.near_misses * 0.5) / row.attempts
            : 0;
        out.push({
          id: s.id,
          itemType,
          title: s.title,
          subtitle: s.subtitle,
          mastery: row.mastery,
          accuracy,
          isSolid: row.mastery >= SOLID_THRESHOLD,
        });
      }
      return out;
    };
    return {
      wordItems: build(
        "word",
        words.map((w) => ({ id: w.id, title: w.word, subtitle: w.meaning_vi }))
      ),
      collocationItems: build(
        "collocation",
        collocations.map((c) => ({ id: c.id, title: c.chunk, subtitle: c.literal_meaning }))
      ),
    };
  }, [rows, words, collocations]);

  const list = useMemo(() => {
    const src = tab === "word" ? wordItems : collocationItems;
    const sorter = (a: ItemProgress, b: ItemProgress) => {
      if (sortBy === "accuracy") return a.accuracy - b.accuracy;
      if (sortBy === "mastery") return a.mastery - b.mastery;
      return a.title.localeCompare(b.title, "en");
    };
    return [...src].sort(sorter);
  }, [tab, wordItems, collocationItems, sortBy]);

  const solidCount = list.filter((i) => i.isSolid).length;
  const totalPracticed = wordItems.length + collocationItems.length;

  return (
    <div>
      <TopBar title="Progress" />
      {authLoading || loading ? (
        <p className="p-6 text-center text-gray-400">Đang tải…</p>
      ) : !userId ? (
        <div className="space-y-3 p-6 text-center">
          <p className="text-gray-600">Đăng nhập để xem tiến độ học của bạn.</p>
          <Link
            href="/login?next=/progress"
            className="inline-block rounded-xl bg-blue-600 px-6 py-2.5 font-semibold text-white"
          >
            Đăng nhập
          </Link>
        </div>
      ) : totalPracticed === 0 ? (
        <div className="space-y-3 p-6 text-center">
          <p className="text-gray-500">
            Chưa có dữ liệu — luyện mục đầu tiên để bắt đầu theo dõi tiến độ.
          </p>
          <Link
            href="/practice"
            className="inline-block rounded-xl bg-blue-600 px-6 py-2.5 font-semibold text-white"
          >
            Luyện ngay
          </Link>
        </div>
      ) : (
        <div className="space-y-5 px-4 py-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-blue-50 p-4 text-center">
              <p className="text-3xl font-bold text-blue-700">{wordItems.length}</p>
              <p className="text-sm text-gray-600">Từ đơn đã học</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-4 text-center">
              <p className="text-3xl font-bold text-purple-700">{collocationItems.length}</p>
              <p className="text-sm text-gray-600">Collocation đã học</p>
            </div>
          </div>

          {/* Tabs 2 tầng */}
          <div className="flex border-b border-gray-200">
            {(
              [
                ["word", `Từ đơn (${wordItems.length})`],
                ["collocation", `Collocation (${collocationItems.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 py-2.5 text-center text-sm font-semibold transition-colors ${
                  tab === key ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase text-gray-500">
                Thành thạo {solidCount}/{list.length}
              </h2>
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

            {list.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">
                Chưa luyện mục nào ở tầng này.
              </p>
            ) : (
              <div className="space-y-2">
                {list.map((ip) => (
                  <ItemCard key={`${ip.itemType}-${ip.id}`} ip={ip} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
