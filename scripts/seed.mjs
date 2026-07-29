// Đẩy seed/categories.mjs + seed/words.mjs vào Supabase.
// Upsert categories theo slug, words theo word (kèm category_slug).
// Cần .env.local có NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { categories } from "../seed/categories.mjs";
import { words } from "../seed/words.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(join(root, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* .env.local optional if vars already set */
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local");
  process.exit(1);
}

async function rest(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    console.error(`${method} ${path} thất bại: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

await rest("categories?on_conflict=slug", {
  method: "POST",
  body: categories,
  prefer: "resolution=merge-duplicates,return=minimal",
});
console.log(`✔ ${categories.length} categories`);

// Seed là content đã duyệt tay → published để qua RLS hiển thị lên FE
const wordRows = words.map(({ category, ...w }) => ({
  ...w,
  category_slug: category ?? null,
  status: "published",
}));
await rest("words?on_conflict=word", {
  method: "POST",
  body: wordRows,
  prefer: "resolution=merge-duplicates,return=minimal",
});
console.log(`✔ ${words.length} words`);
console.log("\nSeed hoàn tất.");
