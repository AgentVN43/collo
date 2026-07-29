"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import {
  AI_TASK_TYPES,
  TASK_CONTRACTS,
  validateTemplate,
  type AiTaskType,
} from "@/lib/aiContracts";

interface Provider {
  id: string;
  name: string;
  base_url: string;
  model: string;
  has_key: boolean;
  key_hint: string;
}
interface Prompt {
  id: string;
  name: string;
  task_type: AiTaskType;
  template: string;
  version: number;
}
interface Task {
  id: string;
  name: string;
  task_type: AiTaskType;
  prompt_id: string;
  provider_id: string;
  schedule: { cycle: string; hour?: number; minute?: number };
  enabled: boolean;
  last_run_at: string | null;
  last_status: string | null;
}
interface Run {
  id: string;
  task_id: string | null;
  word: string;
  status: string;
  error: string;
  started_at: string;
  finished_at: string | null;
}

type Tab = "tasks" | "prompts" | "providers" | "runs";

const inputCls =
  "w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-blue-500";

export default function AiCenterPage() {
  const supabase = getSupabase();
  const [tab, setTab] = useState<Tab>("tasks");
  const [msg, setMsg] = useState<string | null>(null);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);

  // Forms
  const [pForm, setPForm] = useState({ id: "", name: "", base_url: "", model: "", api_key: "", headers: "" });
  const [prForm, setPrForm] = useState({ id: "", name: "", task_type: "word_full" as AiTaskType, template: "" });
  const [tForm, setTForm] = useState({
    id: "",
    name: "",
    task_type: "word_full" as AiTaskType,
    prompt_id: "",
    provider_id: "",
    cycle: "manual",
    hour: 3,
    minute: 0,
  });
  const [runWordByTask, setRunWordByTask] = useState<Record<string, string>>({});
  const [runningTask, setRunningTask] = useState<string | null>(null);

  const token = useCallback(async () => {
    const { data } = await supabase!.auth.getSession();
    return data.session?.access_token ?? "";
  }, [supabase]);

  const api = useCallback(
    async (method: string, body?: unknown) => {
      const res = await fetch("/api/ai/providers", {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      return res.json();
    },
    [token]
  );

  const reload = useCallback(async () => {
    if (!supabase) return;
    const [prov, pr, t, r] = await Promise.all([
      api("GET"),
      supabase.from("ai_prompts").select("*").order("created_at"),
      supabase.from("ai_tasks").select("*").order("created_at"),
      supabase.from("ai_runs").select("id, task_id, word, status, error, started_at, finished_at").order("started_at", { ascending: false }).limit(20),
    ]);
    setProviders(prov.providers ?? []);
    setPrompts((pr.data as Prompt[]) ?? []);
    setTasks((t.data as Task[]) ?? []);
    setRuns((r.data as Run[]) ?? []);
  }, [supabase, api]);

  useEffect(() => {
    if (!supabase) return;
    reload();
  }, [supabase, reload]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 5000);
  };

  // ---- Providers ----
  const saveProvider = async () => {
    if (!pForm.name || !pForm.base_url) return flash("Provider cần name + base_url");
    const res = await api("POST", { ...pForm, id: pForm.id || undefined });
    if (res.error) return flash(`Lỗi: ${res.error}`);
    setPForm({ id: "", name: "", base_url: "", model: "", api_key: "", headers: "" });
    flash("Đã lưu provider");
    reload();
  };
  const deleteProvider = async (id: string) => {
    const res = await api("DELETE", { id });
    if (res.error) return flash(`Lỗi: ${res.error}`);
    reload();
  };

  // ---- Prompts ----
  const savePrompt = async () => {
    if (!supabase || !prForm.name || !prForm.template) return flash("Prompt cần name + template");
    const bad = validateTemplate(prForm.template, prForm.task_type);
    if (bad.length > 0) return flash(`Biến không hợp lệ với task type này: ${bad.join(", ")}`);
    const row = { name: prForm.name, task_type: prForm.task_type, template: prForm.template };
    const q = prForm.id
      ? supabase.from("ai_prompts").update({ ...row, updated_at: new Date().toISOString() }).eq("id", prForm.id)
      : supabase.from("ai_prompts").insert(row);
    const { error } = await q;
    if (error) return flash(`Lỗi: ${error.message}`);
    setPrForm({ id: "", name: "", task_type: "word_full", template: "" });
    flash("Đã lưu prompt");
    reload();
  };

  // ---- Tasks ----
  const saveTask = async () => {
    if (!supabase || !tForm.name || !tForm.prompt_id || !tForm.provider_id)
      return flash("Task cần name + prompt + provider");
    const schedule =
      tForm.cycle === "daily"
        ? { cycle: "daily", hour: tForm.hour, minute: tForm.minute }
        : { cycle: "manual" };
    const row = {
      name: tForm.name,
      task_type: tForm.task_type,
      prompt_id: tForm.prompt_id,
      provider_id: tForm.provider_id,
      schedule,
    };
    const q = tForm.id
      ? supabase.from("ai_tasks").update(row).eq("id", tForm.id)
      : supabase.from("ai_tasks").insert(row);
    const { error } = await q;
    if (error) return flash(`Lỗi: ${error.message}`);
    setTForm({ id: "", name: "", task_type: "word_full", prompt_id: "", provider_id: "", cycle: "manual", hour: 3, minute: 0 });
    flash("Đã lưu task");
    reload();
  };

  const toggleTask = async (t: Task) => {
    if (!supabase) return;
    await supabase.from("ai_tasks").update({ enabled: !t.enabled }).eq("id", t.id);
    reload();
  };

  const runTask = async (t: Task) => {
    const w = (runWordByTask[t.id] ?? "").trim();
    if (!w) return flash("Nhập từ cần chạy trước");
    setRunningTask(t.id);
    const res = await fetch("/api/ai/run", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
      body: JSON.stringify({ task_id: t.id, word: w }),
    });
    const data = await res.json();
    setRunningTask(null);
    flash(data.error ? `❌ ${data.error}` : `✅ Xong "${data.word}" → Đang duyệt`);
    reload();
  };

  const promptsForType = prompts.filter((p) => p.task_type === tForm.task_type);

  return (
    <div>
      <div className="px-4 md:px-6 py-4 space-y-4">
        <h1 className="text-xl font-bold text-gray-900">AI Center</h1>
        {msg && (
          <p className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">{msg}</p>
        )}
        <div className="flex gap-1.5 overflow-x-auto">
          {(
            [
              ["tasks", "Tasks"],
              ["prompts", "Prompts"],
              ["providers", "Providers"],
              ["runs", "Runs"],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
                tab === k ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ==== TASKS ==== */}
        {tab === "tasks" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 p-3 space-y-2">
              <h3 className="font-semibold text-gray-900">{tForm.id ? "Sửa task" : "Tạo task"}</h3>
              <input className={inputCls} placeholder="Task name" value={tForm.name} onChange={(e) => setTForm({ ...tForm, name: e.target.value })} />
              <select className={inputCls} value={tForm.task_type} onChange={(e) => setTForm({ ...tForm, task_type: e.target.value as AiTaskType, prompt_id: "" })}>
                {AI_TASK_TYPES.map((t) => (
                  <option key={t} value={t}>{TASK_CONTRACTS[t].label}</option>
                ))}
              </select>
              <select className={inputCls} value={tForm.prompt_id} onChange={(e) => setTForm({ ...tForm, prompt_id: e.target.value })}>
                <option value="">— Chọn prompt —</option>
                {promptsForType.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} (v{p.version})</option>
                ))}
              </select>
              <select className={inputCls} value={tForm.provider_id} onChange={(e) => setTForm({ ...tForm, provider_id: e.target.value })}>
                <option value="">— Chọn provider —</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.model})</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <select className={inputCls} value={tForm.cycle} onChange={(e) => setTForm({ ...tForm, cycle: e.target.value })}>
                  <option value="manual">Chạy tay</option>
                  <option value="daily">Daily</option>
                </select>
                {tForm.cycle === "daily" && (
                  <>
                    <input type="number" min={0} max={23} className={inputCls} value={tForm.hour} onChange={(e) => setTForm({ ...tForm, hour: Number(e.target.value) })} />
                    <span>:</span>
                    <input type="number" min={0} max={59} className={inputCls} value={tForm.minute} onChange={(e) => setTForm({ ...tForm, minute: Number(e.target.value) })} />
                  </>
                )}
              </div>
              {tForm.cycle === "daily" && (
                <p className="text-xs text-amber-600">Lịch daily được lưu nhưng cron sẽ bật ở phase sau — hiện tại chạy bằng nút.</p>
              )}
              <button onClick={saveTask} className="w-full rounded-xl bg-blue-600 py-2.5 font-semibold text-white">Lưu task</button>
            </div>

            {tasks.map((t) => (
              <div key={t.id} className="rounded-2xl border border-gray-200 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex-1 font-semibold text-gray-900">{t.name}</span>
                  <span className="text-xs text-gray-400">{TASK_CONTRACTS[t.task_type]?.label}</span>
                  <button onClick={() => toggleTask(t)} className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {t.enabled ? "Bật" : "Tắt"}
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  {t.schedule?.cycle === "daily" ? `Daily ${t.schedule.hour}:${String(t.schedule.minute).padStart(2, "0")}` : "Chạy tay"}
                  {t.last_run_at ? ` · lần cuối: ${new Date(t.last_run_at).toLocaleString("vi")} (${t.last_status})` : ""}
                </p>
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    placeholder="Nhập từ (vd: aller)…"
                    value={runWordByTask[t.id] ?? ""}
                    onChange={(e) => setRunWordByTask({ ...runWordByTask, [t.id]: e.target.value })}
                  />
                  <button
                    onClick={() => runTask(t)}
                    disabled={runningTask === t.id || !t.enabled}
                    className="shrink-0 rounded-xl bg-purple-600 px-4 font-semibold text-white disabled:opacity-50"
                  >
                    {runningTask === t.id ? "Đang chạy…" : "▶ Chạy"}
                  </button>
                </div>
              </div>
            ))}
            {tasks.length === 0 && <p className="text-center text-sm text-gray-400">Chưa có task nào.</p>}
          </div>
        )}

        {/* ==== PROMPTS ==== */}
        {tab === "prompts" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 p-3 space-y-2">
              <h3 className="font-semibold text-gray-900">{prForm.id ? "Sửa prompt" : "Tạo prompt"}</h3>
              <input className={inputCls} placeholder="Prompt name" value={prForm.name} onChange={(e) => setPrForm({ ...prForm, name: e.target.value })} />
              <select className={inputCls} value={prForm.task_type} onChange={(e) => setPrForm({ ...prForm, task_type: e.target.value as AiTaskType })}>
                {AI_TASK_TYPES.map((t) => (
                  <option key={t} value={t}>{TASK_CONTRACTS[t].label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500">{TASK_CONTRACTS[prForm.task_type].description}</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(TASK_CONTRACTS[prForm.task_type].vars).map(([v, desc]) => (
                  <button
                    key={v}
                    title={desc}
                    onClick={() => setPrForm({ ...prForm, template: prForm.template + `{{${v}}}` })}
                    className="rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs text-purple-700"
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
              <textarea
                className={`${inputCls} min-h-40 font-mono text-sm`}
                placeholder="Nội dung prompt, dùng {{word}}, {{skeleton_json}}…"
                value={prForm.template}
                onChange={(e) => setPrForm({ ...prForm, template: e.target.value })}
              />
              <button onClick={savePrompt} className="w-full rounded-xl bg-blue-600 py-2.5 font-semibold text-white">Lưu prompt</button>
            </div>
            {prompts.map((p) => (
              <button
                key={p.id}
                onClick={() => setPrForm({ id: p.id, name: p.name, task_type: p.task_type, template: p.template })}
                className="flex w-full items-center rounded-xl border border-gray-200 px-3 py-2.5 text-left"
              >
                <span className="flex-1 font-medium text-gray-900">{p.name}</span>
                <span className="text-xs text-gray-400">{TASK_CONTRACTS[p.task_type]?.label} · v{p.version}</span>
              </button>
            ))}
          </div>
        )}

        {/* ==== PROVIDERS ==== */}
        {tab === "providers" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 p-3 space-y-2">
              <h3 className="font-semibold text-gray-900">{pForm.id ? "Sửa provider" : "Thêm provider"}</h3>
              <input className={inputCls} placeholder="Tên (vd: OpenRouter)" value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} />
              <input className={inputCls} placeholder="Endpoint chat-completions (https://…/v1/chat/completions)" value={pForm.base_url} onChange={(e) => setPForm({ ...pForm, base_url: e.target.value })} />
              <input className={inputCls} placeholder="Model (vd: openai/gpt-4o-mini)" value={pForm.model} onChange={(e) => setPForm({ ...pForm, model: e.target.value })} />
              <input className={inputCls} type="password" placeholder={pForm.id ? "API key (để trống = giữ key cũ)" : "API key"} value={pForm.api_key} onChange={(e) => setPForm({ ...pForm, api_key: e.target.value })} />
              <input className={inputCls} placeholder='Headers thêm, JSON (vd: {"HTTP-Referer":"…"})' value={pForm.headers} onChange={(e) => setPForm({ ...pForm, headers: e.target.value })} />
              <button onClick={saveProvider} className="w-full rounded-xl bg-blue-600 py-2.5 font-semibold text-white">Lưu provider</button>
              <p className="text-xs text-gray-400">API key chỉ lưu và dùng ở server — không bao giờ trả về trình duyệt.</p>
            </div>
            {providers.map((p) => (
              <div key={p.id} className="flex items-center rounded-xl border border-gray-200 px-3 py-2.5">
                <button className="flex-1 text-left" onClick={() => setPForm({ id: p.id, name: p.name, base_url: p.base_url, model: p.model, api_key: "", headers: "" })}>
                  <span className="block font-medium text-gray-900">{p.name} <span className="text-xs text-gray-400">({p.model})</span></span>
                  <span className="block truncate text-xs text-gray-400">{p.base_url} · key {p.key_hint || "chưa có"}</span>
                </button>
                <button onClick={() => deleteProvider(p.id)} className="p-2 text-gray-400">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* ==== RUNS ==== */}
        {tab === "runs" && (
          <div className="space-y-2">
            {runs.map((r) => (
              <div key={r.id} className="rounded-xl border border-gray-200 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex-1 font-medium text-gray-900">{r.word}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.status === "success"
                        ? "bg-green-100 text-green-700"
                        : r.status === "failed"
                          ? "bg-red-100 text-red-600"
                          : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{new Date(r.started_at).toLocaleString("vi")}</p>
                {r.error && <p className="mt-1 text-xs text-red-600">{r.error}</p>}
              </div>
            ))}
            {runs.length === 0 && <p className="text-center text-sm text-gray-400">Chưa có lần chạy nào.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
