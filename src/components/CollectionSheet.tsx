"use client";

import { useEffect, useState } from "react";
import BottomSheet from "./BottomSheet";
import { getSupabase } from "@/lib/supabase";
import {
  createCollection,
  fetchCollections,
  membershipForWord,
  toggleWordInCollection,
  type CollectionWithCount,
} from "@/lib/collections";

/**
 * Bottom sheet "Thêm vào bộ sưu tập": list bộ mới cập nhật trước (sheet cuộn được),
 * tap để thêm/bỏ từ; nút Tạo mở form bộ sưu tập mới.
 */
export default function CollectionSheet({
  wordId,
  userId,
  onClose,
  onSavedChange,
}: {
  wordId: string | null; // null = đóng
  userId: string;
  onClose: () => void;
  onSavedChange?: (wordId: string, saved: boolean) => void;
}) {
  const supabase = getSupabase();
  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [member, setMember] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase || !wordId) return;
    setLoading(true);
    setCreating(false);
    setNewName("");
    Promise.all([fetchCollections(supabase), membershipForWord(supabase, wordId)]).then(
      ([cols, mem]) => {
        setCollections(cols);
        setMember(mem);
        setLoading(false);
      }
    );
  }, [supabase, wordId]);

  if (!wordId) return null;

  const notifySaved = (mem: Set<string>) => onSavedChange?.(wordId, mem.size > 0);

  const toggle = async (collectionId: string) => {
    if (!supabase || busy) return;
    const add = !member.has(collectionId);
    const next = new Set(member);
    if (add) next.add(collectionId);
    else next.delete(collectionId);
    setMember(next);
    setCollections((cols) =>
      cols.map((c) =>
        c.id === collectionId ? { ...c, word_count: c.word_count + (add ? 1 : -1) } : c
      )
    );
    notifySaved(next);
    await toggleWordInCollection(supabase, collectionId, wordId, add);
  };

  const create = async () => {
    if (!supabase || !newName.trim() || busy) return;
    setBusy(true);
    const col = await createCollection(supabase, userId, newName);
    if (col) {
      await toggleWordInCollection(supabase, col.id, wordId, true);
      const next = new Set(member);
      next.add(col.id);
      setMember(next);
      setCollections([{ ...col, word_count: 1 }, ...collections]);
      notifySaved(next);
      setCreating(false);
      setNewName("");
    }
    setBusy(false);
  };

  return (
    <BottomSheet open onClose={onClose}>
      <div className="px-4 pb-8">
        {/* Heading: trái tiêu đề — phải nút tạo */}
        <div className="flex items-center justify-between py-3">
          <h2 className="font-semibold text-gray-900">Thêm vào bộ sưu tập</h2>
          <button
            onClick={() => setCreating(!creating)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white"
          >
            {creating ? "Đóng" : "＋ Tạo"}
          </button>
        </div>

        {creating && (
          <div className="mb-3 rounded-xl border border-gray-200 p-3 space-y-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Tên bộ sưu tập"
              autoFocus
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500"
            />
            {/* Placeholder cho phase sau */}
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
              disabled={!newName.trim() || busy}
              className="w-full rounded-xl bg-blue-600 py-2.5 font-semibold text-white disabled:opacity-50"
            >
              Tạo & thêm từ
            </button>
          </div>
        )}

        {loading ? (
          <p className="py-6 text-center text-gray-400">Đang tải…</p>
        ) : collections.length === 0 && !creating ? (
          <p className="py-6 text-center text-sm text-gray-500">
            Chưa có bộ sưu tập nào — bấm ＋ Tạo để bắt đầu.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {collections.map((c) => {
              const inCol = member.has(c.id);
              return (
                <li key={c.id}>
                  <button
                    onClick={() => toggle(c.id)}
                    className="flex w-full items-center gap-3 py-3 text-left"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-sm ${
                        inCol ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate font-medium text-gray-900">{c.name}</span>
                      <span className="text-xs text-gray-400">{c.word_count} từ</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </BottomSheet>
  );
}
