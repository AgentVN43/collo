# Folask — Luyện chia động từ tiếng Pháp

PWA mobile-first cho người Việt học tiếng Pháp level cơ bản. Khác biệt với các app dạng bảng chia (Conjuu): **Level 2 luyện chia động từ trong câu có ngữ cảnh** — người học phải tự nhận tín hiệu thời gian (hier, demain, ce soir…) để chọn thì.

**Stack:** Next.js (App Router) · Supabase (Postgres + Auth email/password) · Tailwind CSS.

## Cài đặt

1. **Tạo project Supabase** → SQL Editor → chạy toàn bộ [`supabase/schema.sql`](supabase/schema.sql).
2. **Tắt xác nhận email:** Dashboard → Authentication → Sign In / Providers → Email → tắt "Confirm email".
3. **Cấu hình env:** copy `.env.local.example` thành `.env.local`, điền:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Settings → API)
   - `SUPABASE_SERVICE_ROLE_KEY` (Settings → API → service_role)
   - `IMPORT_API_KEY` — chuỗi ngẫu nhiên dài tự đặt, bảo vệ endpoint import
4. **Seed 13 động từ mẫu:** `npm run seed`
5. **Chạy:** `npm run dev` → http://localhost:3000

## Import từ mới qua Postman

Không cần sửa code khi thêm dữ liệu — POST thẳng vào endpoint:

```
POST /api/words/import
Header: x-api-key: <IMPORT_API_KEY>
Body (JSON): một object hoặc mảng objects
```

```json
{
  "word": "parler",
  "word_type": "v.",
  "category": "nhom-er",
  "meaning_vi": "nói chuyện",
  "meaning_en": "to speak",
  "basics_vi": "Động từ nhóm 1 (-er), quy tắc.",
  "conjugations": {
    "present": {
      "rule_vi": "Bỏ -er, thêm -e, -es, -e, -ons, -ez, -ent.",
      "forms": { "j": "parle", "tu": "parles", "il_elle": "parle", "nous": "parlons", "vous": "parlez", "elles": "parlent" },
      "examples": [{ "fr": "Je parle un peu français.", "vi": "Tôi nói được một chút tiếng Pháp." }],
      "cloze": [
        { "before": "Tu ", "after": " très bien français !", "answer": "parles", "hint": "parler", "explain_vi": "Présent, tu + -es: parles." }
      ]
    }
  }
}
```

Upsert theo cột `word` — gửi lại từ đã có sẽ cập nhật nội dung.

- `category`: đúng 1 slug nhóm chia (`nhom-er` / `nhom-ir` / `nhom-3`) từ bảng `categories`. Slug phải tồn tại sẵn — danh mục quản lý ở [seed/categories.mjs](seed/categories.mjs), thêm category mới thì sửa file đó rồi `npm run seed`.

> Quy trình đầy đủ để tạo batch dữ liệu mới (AI sinh → `npm run validate` → duyệt tay → import → smoke test): xem [docs/CONTENT.md](docs/CONTENT.md).

- Thì hợp lệ: `present`, `passe_compose`, `futur_proche`.
- `alt` (tùy chọn, trong tense hoặc trong cloze): các đáp án thay thế được chấp nhận (vd hợp giống với être: `"est allée"`).

## Deploy lên Vercel

Repo đã có [`vercel.json`](vercel.json) (framework Next.js, region `sin1` — Singapore, gần người dùng VN nhất).

1. Push code lên GitHub, rồi vào [vercel.com/new](https://vercel.com/new) → Import repo (hoặc dùng CLI: `npx vercel`).
2. Trong **Project Settings → Environment Variables**, thêm đủ 4 biến (cho Production + Preview):

   | Biến | Ghi chú |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Public — xuất hiện ở client |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public — xuất hiện ở client |
   | `SUPABASE_SERVICE_ROLE_KEY` | **Secret** — chỉ server dùng cho `/api/words/import` |
   | `IMPORT_API_KEY` | **Secret** — khóa bảo vệ endpoint import |

3. Deploy. Sau khi có domain, kiểm tra:
   - Mở app trên điện thoại → menu trình duyệt → **Add to Home Screen** (PWA).
   - Test import: `POST https://<domain>/api/words/import` với header `x-api-key`.
4. **Supabase**: vào Authentication → URL Configuration, thêm domain Vercel vào **Site URL / Redirect URLs** để auth hoạt động trên production.

Lưu ý: `npm run seed` chạy từ máy local (đọc `.env.local`), không chạy trên Vercel — seed thẳng vào Supabase nên deploy xong không cần seed lại.

## Cơ chế Progress

Bảng `progress` khóa `(user_id, word_id, tense, level)`. Khi bắt đầu luyện một từ, app upsert dòng progress (kích hoạt theo dõi). Mỗi phiên: cập nhật `attempts / fails / near_misses`; điểm ≥80% → `mastery +1` và mở khóa Level 2; <50% → `mastery −1`. `next_due` giãn theo mastery: 1 → 3 → 7 → 14 ngày. Hàng đợi Practice ưu tiên: từ quá hạn ôn → fail-rate cao → cùng chủ đề mastery thấp → từ mới. Sai chỉ do dấu (accent) tính "gần đúng" (nửa điểm), không phạt như sai thì.
