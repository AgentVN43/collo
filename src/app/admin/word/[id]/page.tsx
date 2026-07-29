"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import WordDetail from "@/components/WordDetail";
import FeedbackSheet from "@/components/FeedbackSheet";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { fetchWordAdmin } from "@/lib/words";
import { adminUpdateWord, type AdminWordPatch } from "@/lib/admin";
import { STATUS_LABELS, type Category, type Word, type WordStatus } from "@/lib/types";

export default function AdminWordPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useSession();
  const supabase = getSupabase();
  const [word, setWord] = useState<Word | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Form sửa nội dung text (word_type, nghĩa, kiến thức cơ bản)
  const [form, setForm] = useState({ word_type: "", meaning_vi: "", meaning_en: "", basics_vi: "" });
  const [savedMsg, setSavedMsg] = useState(false);
  const [aiTasks, setAiTasks] = useState<{ id: string; name: string }[]>([]);
  const [aiTaskId, setAiTaskId] = useState("");
  const [aiRunning, setAiRunning] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    if (!supabase || !id) return;
    Promise.all([
      fetchWordAdmin(supabase, id),
      supabase.from("categories").select("*").order("sort_order"),
    ]).then(([w, catRes]) => {
      setWord(w);
      setCategory(w?.category_slug ?? "");
      if (w) {
        setForm({
          word_type: w.word_type,
          meaning_vi: w.meaning_vi,
          meaning_en: w.meaning_en,
          basics_vi: w.basics_vi,
        });
      }
      setCategories((catRes.data as Category[]) ?? []);
      setLoading(false);
    });
    supabase
      .from("ai_tasks")
      .select("id, name")
      .eq("enabled", true)
      .then(({ data }) => setAiTasks((data as { id: string; name: string }[]) ?? []));
  }, [supabase, id]);

  const runAi = async () => {
    if (!supabase || !word || !aiTaskId || aiRunning) return;
    setAiRunning(true);
    setAiMsg("Đang chạy AI…");
    const { data: sess } = await supabase.auth.getSession();
    const res = await fetch("/api/ai/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sess.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ task_id: aiTaskId, word: word.word }),
    });
    const data = await res.json();
    if (data.error) setAiMsg(`❌ ${data.error}`);
    else {
      setAiMsg("✅ Xong — nội dung đã cập nhật, trạng thái chuyển Đang duyệt.");
      const fresh = await fetchWordAdmin(supabase, word.id);
      if (fresh) {
        setWord(fresh);
        setCategory(fresh.category_slug ?? "");
        setForm({
          word_type: fresh.word_type,
          meaning_vi: fresh.meaning_vi,
          meaning_en: fresh.meaning_en,
          basics_vi: fresh.basics_vi,
        });
      }
    }
    setAiRunning(false);
  };

  // Điều kiện được publish: đã duyệt xong nội dung tối thiểu
  const publishBlockers = useMemo(() => {
    if (!word) return [];
    const blockers: string[] = [];
    if (!category) blockers.push("chưa chọn category");
    if (!word.meaning_vi.trim()) blockers.push("chưa có nghĩa tiếng Việt");
    if (word.partnerships.length === 0) blockers.push("chưa có partnership nào");
    return blockers;
  }, [word, category]);

  const update = async (patch: AdminWordPatch) => {
    if (!supabase || !word || busy) return;
    setBusy(true);
    setError(null);
    const err = await adminUpdateWord(supabase, word.id, patch);
    if (err) setError(err);
    else if (patch.status) {
      setWord({ ...word, status: patch.status });
      if (patch.status === "published") router.push("/admin");
    }
    setBusy(false);
  };

  const changeCategory = async (slug: string) => {
    setCategory(slug);
    await update({ category_slug: slug || null });
  };

  const saveContent = async () => {
    if (!supabase || !word || busy) return;
    setBusy(true);
    setError(null);
    setSavedMsg(false);
    const patch = {
      word_type: form.word_type.trim(),
      meaning_vi: form.meaning_vi.trim(),
      meaning_en: form.meaning_en.trim(),
      basics_vi: form.basics_vi.trim(),
    };
    const err = await adminUpdateWord(supabase, word.id, patch);
    if (err) setError(err);
    else {
      setWord({ ...word, ...patch });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 3000);
    }
    setBusy(false);
  };

  const dirty =
    !!word &&
    (form.word_type !== word.word_type ||
      form.meaning_vi !== word.meaning_vi ||
      form.meaning_en !== word.meaning_en ||
      form.basics_vi !== word.basics_vi);

  if (loading)
    return (
      <div>
        <TopBar title="Duyệt từ" back wide />
        <p className="p-6 text-center text-gray-400">Đang tải…</p>
      </div>
    );

  if (!word)
    return (
      <div>
        <TopBar title="Duyệt từ" back wide />
        <p className="p-6 text-center text-gray-500">Không tìm thấy từ này.</p>
      </div>
    );

  return (
    <div>
      <TopBar title={`Duyệt: ${word.word}`} back wide />
      <div className="px-4 md:px-6 py-4 space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
          <span className="text-sm text-gray-600">Trạng thái hiện tại</span>
          <span className="font-semibold text-gray-900">{STATUS_LABELS[word.status]}</span>
        </div>

        {/* Bước duyệt: chọn category trước khi publish */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-500">Category (loại collocation)</label>
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

        {/* Sửa nội dung text — nghĩa, loại từ, kiến thức cơ bản */}
        <div className="rounded-2xl border border-gray-200 p-3 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Sửa nội dung</h3>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Loại từ</label>
            <input
              value={form.word_type}
              onChange={(e) => setForm({ ...form, word_type: e.target.value })}
              placeholder="vd: v."
              className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Nghĩa tiếng Việt</label>
            <input
              value={form.meaning_vi}
              onChange={(e) => setForm({ ...form, meaning_vi: e.target.value })}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Nghĩa tiếng Anh</label>
            <input
              value={form.meaning_en}
              onChange={(e) => setForm({ ...form, meaning_en: e.target.value })}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Kiến thức cơ bản</label>
            <textarea
              value={form.basics_vi}
              onChange={(e) => setForm({ ...form, basics_vi: e.target.value })}
              rows={4}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 resize-y"
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

        {/* Hành động theo flow draft → processing → published */}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="space-y-2">
          {word.status === "draft" && (
            <button
              onClick={() => update({ status: "processing" })}
              disabled={busy}
              className="w-full rounded-xl bg-yellow-500 py-3 font-semibold text-white disabled:opacity-50"
            >
              Bắt đầu duyệt (→ Đang duyệt)
            </button>
          )}
          {word.status === "processing" && (
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
          {word.status === "published" && (
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
          {word.status === "archived" && (
            <button
              onClick={() => update({ status: "draft" })}
              disabled={busy}
              className="w-full rounded-xl border border-gray-300 py-3 font-semibold text-gray-600"
            >
              Khôi phục về Nháp
            </button>
          )}
        </div>

        {/* Chạy AI soạn nội dung cho từ này — context {{word}} được bơm tự động */}
        {aiTasks.length > 0 && (
          <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-3 space-y-2">
            <h3 className="text-sm font-semibold text-purple-700">🤖 Chạy AI cho từ này</h3>
            <div className="flex gap-2">
              <select
                value={aiTaskId}
                onChange={(e) => setAiTaskId(e.target.value)}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2"
              >
                <option value="">— Chọn task —</option>
                {aiTasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button
                onClick={runAi}
                disabled={!aiTaskId || aiRunning}
                className="shrink-0 rounded-xl bg-purple-600 px-4 font-semibold text-white disabled:opacity-50"
              >
                {aiRunning ? "…" : "▶ Chạy"}
              </button>
            </div>
            {aiMsg && <p className="text-sm text-purple-800">{aiMsg}</p>}
          </div>
        )}

        {/* Preview nội dung như người học sẽ thấy */}
        <div className="rounded-2xl border border-gray-200">
          <p className="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase text-gray-400">
            Preview nội dung
          </p>
          <WordDetail
            word={{ ...word, category_slug: category || null }}
            onFeedback={() => setFeedbackOpen(true)}
          />
        </div>
        <p className="text-xs text-gray-400">
          Sửa được nghĩa, loại từ và kiến thức cơ bản ngay tại đây. Word partnerships (ví dụ,
          cloze…) cập nhật qua chạy AI hoặc import trực tiếp bằng SQL.
        </p>
      </div>
      {userId && feedbackOpen && (
        <FeedbackSheet
          wordId={word.id}
          userId={userId}
          onClose={() => setFeedbackOpen(false)}
        />
      )}
    </div>
  );
}
