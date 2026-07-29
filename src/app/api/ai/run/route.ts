import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/serverAdmin";
import { renderPrompt, type AiTaskType } from "@/lib/aiContracts";

export const runtime = "nodejs";
export const maxDuration = 60;

type Json = Record<string, unknown>;

/** Bóc JSON từ output AI (chấp nhận có/không markdown fence). */
function parseAiJson(text: string): Json | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return (parsed[0] as Json) ?? null;
    return typeof parsed === "object" && parsed !== null ? (parsed as Json) : null;
  } catch {
    // thử tìm khối {...} lớn nhất
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as Json;
    } catch {
      return null;
    }
  }
}

/**
 * POST /api/ai/run — chạy một task cho một từ (kích hoạt chủ động).
 * Body: { task_id: string, word: string }
 * Flow: render prompt từ contract → gọi provider (OpenAI-compatible) → merge kết quả
 * vào words theo policy của task_type (forms/alt luôn được bảo toàn) → status 'processing'.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = auth.admin;

  const body = (await req.json().catch(() => null)) as { task_id?: string; word?: string } | null;
  if (!body?.task_id || !body?.word) {
    return NextResponse.json({ error: "Cần task_id và word" }, { status: 400 });
  }

  // Nạp task + prompt + provider + word
  const { data: task } = await db.from("ai_tasks").select("*").eq("id", body.task_id).maybeSingle();
  if (!task) return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });
  if (!task.enabled) return NextResponse.json({ error: "Task đang tắt" }, { status: 400 });

  const [{ data: prompt }, { data: provider }, { data: word }] = await Promise.all([
    db.from("ai_prompts").select("*").eq("id", task.prompt_id).maybeSingle(),
    db.from("ai_providers").select("*").eq("id", task.provider_id).maybeSingle(),
    db.from("words").select("*").eq("word", body.word.trim().toLowerCase()).maybeSingle(),
  ]);
  if (!prompt) return NextResponse.json({ error: "Không tìm thấy prompt" }, { status: 404 });
  if (!provider) return NextResponse.json({ error: "Không tìm thấy provider" }, { status: 404 });
  if (!word) return NextResponse.json({ error: `Không tìm thấy từ "${body.word}"` }, { status: 404 });

  // Dựng context theo contract
  const partnerships = (word.partnerships ?? []) as Json[];
  const skeleton = {
    word: word.word,
    category: word.category_slug ?? "",
    meaning_vi: word.meaning_vi,
    meaning_en: word.meaning_en,
    partnerships,
  };
  const ctx: Record<string, string> = {
    word: word.word,
    category: word.category_slug ?? "(chưa phân loại)",
    meaning_vi: word.meaning_vi,
    meaning_en: word.meaning_en,
    partnerships_list: partnerships.map((p) => `${p.key}: ${p.phrase}`).join(", "),
    skeleton_json: JSON.stringify(skeleton, null, 1),
  };
  const rendered = renderPrompt(prompt.template, ctx);

  // Ghi run (running)
  const { data: run } = await db
    .from("ai_runs")
    .insert({ task_id: task.id, word_id: word.id, word: word.word, status: "running", input: rendered })
    .select("id")
    .single();
  const runId = run?.id;

  const fail = async (message: string, output = "") => {
    if (runId)
      await db
        .from("ai_runs")
        .update({ status: "failed", error: message, output, finished_at: new Date().toISOString() })
        .eq("id", runId);
    await db
      .from("ai_tasks")
      .update({ last_run_at: new Date().toISOString(), last_status: "failed" })
      .eq("id", task.id);
    return NextResponse.json({ error: message, run_id: runId }, { status: 502 });
  };

  // Gọi provider (OpenAI-compatible chat completions)
  let content = "";
  try {
    const res = await fetch(provider.base_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.api_key}`,
        ...(provider.headers ?? {}),
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: "user", content: rendered }],
      }),
      signal: AbortSignal.timeout(55_000),
    });
    if (!res.ok) return await fail(`Provider trả ${res.status}: ${(await res.text()).slice(0, 400)}`);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    content = data.choices?.[0]?.message?.content ?? "";
    if (!content) return await fail("Provider không trả về nội dung");
  } catch (e) {
    return await fail(`Lỗi gọi provider: ${e instanceof Error ? e.message : String(e)}`);
  }

  const aiWord = parseAiJson(content);
  if (!aiWord) return await fail("Output không phải JSON hợp lệ", content.slice(0, 4000));

  // Merge theo policy của task_type — phrase/alt LUÔN lấy từ DB, AI không được đổi
  const taskType = task.task_type as AiTaskType;
  const aiPartnerships = Array.isArray(aiWord.partnerships) ? (aiWord.partnerships as Json[]) : [];
  const aiByKey = new Map(aiPartnerships.map((p) => [p.key, p]));
  const mergedPartnerships: Json[] = [];
  const clozeErrors: string[] = [];

  for (const dbP of partnerships) {
    const ai = aiByKey.get(dbP.key) ?? {};
    const dbAlt = (dbP.alt as string[] | undefined) ?? [];
    const accepted = new Set([dbP.phrase as string, ...dbAlt]);

    if (taskType === "word_theory") {
      mergedPartnerships.push({
        ...dbP,
        rule_vi: typeof ai.rule_vi === "string" && ai.rule_vi ? ai.rule_vi : dbP.rule_vi,
        meaning_vi: typeof ai.meaning_vi === "string" && ai.meaning_vi ? ai.meaning_vi : dbP.meaning_vi,
      });
    } else {
      const cloze = Array.isArray(ai.cloze) ? (ai.cloze as Json[]) : [];
      for (const [i, c] of cloze.entries()) {
        if (typeof c.answer !== "string" || !accepted.has(c.answer)) {
          clozeErrors.push(`${dbP.key}.cloze[${i}]: answer "${String(c.answer)}" không khớp phrase/alt`);
        }
      }
      mergedPartnerships.push({
        key: dbP.key,
        phrase: dbP.phrase, // bảo toàn
        ...(dbP.alt ? { alt: dbP.alt } : {}),
        rule_vi: typeof ai.rule_vi === "string" ? ai.rule_vi : (dbP.rule_vi ?? ""),
        meaning_vi: typeof ai.meaning_vi === "string" ? ai.meaning_vi : (dbP.meaning_vi ?? ""),
        examples: Array.isArray(ai.examples) ? ai.examples : (dbP.examples ?? []),
        cloze,
      });
    }
  }
  if (clozeErrors.length > 0) {
    return await fail(`Cloze không hợp lệ: ${clozeErrors.join("; ")}`, content.slice(0, 4000));
  }

  const patch: Json = { partnerships: mergedPartnerships, status: "processing" };
  if (taskType === "word_full") {
    if (typeof aiWord.meaning_vi === "string" && aiWord.meaning_vi) patch.meaning_vi = aiWord.meaning_vi;
    if (typeof aiWord.meaning_en === "string" && aiWord.meaning_en) patch.meaning_en = aiWord.meaning_en;
  }
  if (typeof aiWord.basics_vi === "string" && aiWord.basics_vi) patch.basics_vi = aiWord.basics_vi;

  const { error: updateErr } = await db.from("words").update(patch).eq("id", word.id);
  if (updateErr) return await fail(`Ghi DB thất bại: ${updateErr.message}`, content.slice(0, 4000));

  if (runId)
    await db
      .from("ai_runs")
      .update({ status: "success", output: content.slice(0, 8000), finished_at: new Date().toISOString() })
      .eq("id", runId);
  await db
    .from("ai_tasks")
    .update({ last_run_at: new Date().toISOString(), last_status: "success" })
    .eq("id", task.id);

  return NextResponse.json({ ok: true, run_id: runId, word: word.word, status: "processing" });
}
