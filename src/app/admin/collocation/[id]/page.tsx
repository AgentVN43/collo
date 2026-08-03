"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import CollocationDetail from "@/components/CollocationDetail";
import { getSupabase } from "@/lib/supabase";
import { fetchCollocationAdmin } from "@/lib/collocations";
import { adminUpdateContent, type AdminCollocationPatch } from "@/lib/admin";
import { STATUS_LABELS, type Category, type Collocation, type Word } from "@/lib/types";

export default function AdminCollocationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = getSupabase();
  const [collocation, setCollocation] = useState<Collocation | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ literal_meaning: "", note_vi: "" });
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    if (!supabase || !id) return;
    Promise.all([
      fetchCollocationAdmin(supabase, id),
      supabase.from("categories").select("*").order("sort_order"),
      // Admin đọc được từ đơn ở mọi status → query qua bảng nối
      supabase
        .from("word_collocations")
        .select("word:words(id, word, meaning_vi, status)")
        .eq("collocation_id", id),
    ]).then(([c, catRes, linkRes]) => {
      setCollocation(c);
      setCategory(c?.category_slug ?? "");
      if (c) setForm({ literal_meaning: c.literal_meaning, note_vi: c.note_vi });
      setCategories((catRes.data as Category[]) ?? []);
      // PostgREST trả embed dạng mảng lồng — cast qua unknown rồi làm phẳng
      const links = (linkRes.data as unknown as { word: Word | null }[]) ?? [];
      setWords(links.map((l) => l.word).filter(Boolean) as Word[]);
      setLoading(false);
    });
  }, [supabase, id]);

  const publishBlockers = useMemo(() => {
    if (!collocation) return [];
    const blockers: string[] = [];
    if (!category) blockers.push("chưa chọn loại collocation");
    if (!collocation.literal_meaning.trim()) blockers.push("chưa có nghĩa tiếng Việt");
    if (words.length === 0) blockers.push("chưa liên kết từ đơn nào");
    return blockers;
  }, [collocation, category, words]);

  const update = async (patch: AdminCollocationPatch) => {
    if (!supabase || !collocation || busy) return;
    setBusy(true);
    setError(null);
    const err = await adminUpdateContent(supabase, "collocations", collocation.id, patch);
    if (err) setError(err);
    else if (patch.status) {
      setCollocation({ ...collocation, status: patch.status });
      if (patch.status === "published") router.push("/admin");
    }
    setBusy(false);
  };

  const changeCategory = async (slug: string) => {
    setCategory(slug);
    await update({ category_slug: slug || null });
  };

  const saveContent = async () => {
    if (!supabase || !collocation || busy) return;
    setBusy(true);
    setError(null);
    setSavedMsg(false);
    const patch = {
      literal_meaning: form.literal_meaning.trim(),
      note_vi: form.note_vi.trim(),
    };
    const err = await adminUpdateContent(supabase, "collocations", collocation.id, patch);
    if (err) setError(err);
    else {
      setCollocation({ ...collocation, ...patch });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 3000);
    }
    setBusy(false);
  };

  const dirty =
    !!collocation &&
    (form.literal_meaning !== collocation.literal_meaning || form.note_vi !== collocation.note_vi);

  if (loading)
    return (
      <div>
        <TopBar title="Duyệt collocation" back wide />
        <p className="p-6 text-center text-gray-400">Đang tải…</p>
      </div>
    );

  if (!collocation)
    return (
      <div>
        <TopBar title="Duyệt collocation" back wide />
        <p className="p-6 text-center text-gray-500">Không tìm thấy cụm từ này.</p>
      </div>
    );

  return (
    <div>
      <TopBar title={`Duyệt: ${collocation.chunk}`} back wide />
      <div className="space-y-4 px-4 py-4 md:px-6">
        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
          <span className="text-sm text-gray-600">Trạng thái hiện tại</span>
          <span className="font-semibold text-gray-900">{STATUS_LABELS[collocation.status]}</span>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-500">
            Loại collocation (7 loại chuẩn)
          </label>
          <select
            value={category}
            onChange={(e) => changeCategory(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5"
          >
            <option value="">— Chưa chọn —</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3 rounded-2xl border border-gray-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700">Sửa nội dung</h3>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Nghĩa tiếng Việt</label>
            <input
              value={form.literal_meaning}
              onChange={(e) => setForm({ ...form, literal_meaning: e.target.value })}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Cách dùng</label>
            <textarea
              value={form.note_vi}
              onChange={(e) => setForm({ ...form, note_vi: e.target.value })}
              rows={4}
              className="w-full resize-y rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={saveContent}
            disabled={busy || !dirty}
            className="w-full rounded-xl bg-blue-600 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Đang lưu…" : dirty ? "Lưu nội dung" : "Đã lưu"}
          </button>
          {savedMsg && <p className="text-center text-sm text-green-600">✅ Đã lưu nội dung.</p>}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="space-y-2">
          {collocation.status === "draft" && (
            <button
              onClick={() => update({ status: "processing" })}
              disabled={busy}
              className="w-full rounded-xl bg-yellow-500 py-3 font-semibold text-white disabled:opacity-50"
            >
              Bắt đầu duyệt (→ Đang duyệt)
            </button>
          )}
          {collocation.status === "processing" && (
            <>
              <button
                onClick={() => update({ status: "published" })}
                disabled={busy || publishBlockers.length > 0}
                className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white disabled:opacity-50"
              >
                ✓ Publish
              </button>
              {publishBlockers.length > 0 && (
                <p className="text-center text-xs text-amber-600">
                  Chưa publish được: {publishBlockers.join(" · ")}
                </p>
              )}
              <button
                onClick={() => update({ status: "draft" })}
                disabled={busy}
                className="w-full rounded-xl border border-gray-300 py-2.5 text-sm font-semibold text-gray-600"
              >
                Trả về Nháp
              </button>
            </>
          )}
          {collocation.status === "published" && (
            <>
              <button
                onClick={() => update({ status: "archived" })}
                disabled={busy}
                className="w-full rounded-xl border border-red-300 py-3 font-semibold text-red-600 disabled:opacity-50"
              >
                Gỡ khỏi app (→ Lưu trữ)
              </button>
              <button
                onClick={() => update({ status: "draft" })}
                disabled={busy}
                className="w-full rounded-xl border border-gray-300 py-2.5 text-sm font-semibold text-gray-600"
              >
                Trả về Nháp để sửa
              </button>
            </>
          )}
          {collocation.status === "archived" && (
            <button
              onClick={() => update({ status: "draft" })}
              disabled={busy}
              className="w-full rounded-xl border border-gray-300 py-3 font-semibold text-gray-600"
            >
              Khôi phục về Nháp
            </button>
          )}
        </div>

        {/* Thống kê nội dung phụ trợ */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Ví dụ", collocation.examples.length],
            ["Ngữ cảnh", collocation.variants.length],
            ["Bài tập", collocation.exercises.length],
          ].map(([label, n]) => (
            <div key={label as string} className="rounded-xl bg-gray-50 py-2">
              <p className="text-lg font-bold text-gray-900">{n}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-gray-200">
          <p className="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase text-gray-400">
            Preview nội dung
          </p>
          <CollocationDetail
            collocation={{ ...collocation, category_slug: category || null }}
            words={words}
          />
        </div>
        <p className="text-xs text-gray-400">
          Ví dụ, ngữ cảnh (casual/formal/alternative) và bài tập cập nhật qua POST /api/words/import.
        </p>
      </div>
    </div>
  );
}
