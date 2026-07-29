# Quy trình tạo dữ liệu từ vựng mới

Nguyên tắc xuyên suốt: **file JSON là source of truth, không phải database.** DB có thể clean + import lại bất cứ lúc nào từ file; file được commit git nên có lịch sử, review được, rollback được.

```
① Chọn từ  →  ② AI sinh draft  →  ③ npm run validate (máy)  →  ④ Duyệt tay (người)
                                                                        ↓
                            ⑥ Smoke test trong app  ←  ⑤ Import (Postman / seed)
```

## ① Chọn từ — trước khi sinh dữ liệu

- Chọn theo **chủ đề trọn vẹn** (10–20 từ/batch), không thêm từ lẻ tẻ — cơ chế luyện ưu tiên "cùng chủ đề" chỉ phát huy khi chủ đề có đủ từ.
- Ưu tiên tần suất sử dụng thực tế (danh sách 200 động từ Pháp phổ biến nhất) thay vì thứ tự bảng chữ cái.
- Quyết định trước: batch này cần những **thì** nào? Không bắt buộc đủ 15 thì — từ hiếm chỉ cần 3 thì lõi.

### Category dùng slug từ danh mục chuẩn [`seed/categories.mjs`](../seed/categories.mjs)

- Mỗi từ có **đúng 1 `category`** = nhóm chia theo cách chia ở présent: `nhom-er` (1er groupe) / `nhom-ir` (2e groupe kiểu finir) / `nhom-3` (bất quy tắc). Home nhóm section theo category, word_detail hiện 1 badge.
- Tính chất bổ sung (phản thân, khiếm khuyết, đi với être ở thì kép) **không phải category** — thể hiện trong `basics_vi`, `rule_vi` và forms/`alt`.
- Thêm category mới: thêm dòng vào `seed/categories.mjs` (slug không dấu, KHÔNG đổi slug cũ) rồi `npm run seed` — sau đó batch mới mới được dùng slug đó.

## ② Sinh draft bằng AI

Mỗi batch một file JSON trong `content/` (vd `content/2026-07-nau-an.json`).

> **Ưu tiên chế độ SKELETON khi có nguồn chuẩn**: tải RTF từ Le Conjugueur →
> `npm run parse:rtf <thư-mục> -- -o content/skeleton.json` — bảng chia được trích
> nguyên văn từ nguồn (đủ 15 thì, tự nhận nhóm động từ, tự sinh alt hợp giống cho
> động từ đi với être), AI chỉ điền nghĩa/rule/ví dụ/cloze, **không bao giờ tự chia thì**.
> Prompt điền skeleton nằm cuối [AI-CONTENT-PROMPT.md](AI-CONTENT-PROMPT.md).

> **Dùng AI agent ngoài (ChatGPT/Gemini/Claude...)**: copy nguyên prompt tự chứa trong
> [AI-CONTENT-PROMPT.md](AI-CONTENT-PROMPT.md) — đã gồm đủ schema, slug topics, ràng buộc
> và mẹo vận hành (batch 5-8 từ, vòng sửa lỗi bằng output của validator).

Prompt mẫu (bản rút gọn):

> Tạo dữ liệu JSON cho các động từ tiếng Pháp sau: `<danh sách>`, các thì: `<danh sách thì>`.
> Trả về MẢNG JSON, mỗi từ theo đúng schema sau (không thêm field khác):
>
> ```json
> {
>   "word": "parler",
>   "word_type": "v.",
>   "category": "nhom-er",
>   "meaning_vi": "nói chuyện",
>   "meaning_en": "to speak",
>   "basics_vi": "2-3 câu tiếng Việt: nhóm động từ, trợ động từ ở thì kép, ngoại lệ nếu có.",
>   "conjugations": {
>     "present": {
>       "rule_vi": "Quy tắc chia bằng tiếng Việt, ngắn gọn.",
>       "forms": { "j": "parle", "tu": "parles", "il_elle": "parle", "nous": "parlons", "vous": "parlez", "elles": "parlent" },
>       "examples": [{ "fr": "câu ví dụ", "vi": "bản dịch" }],
>       "cloze": [{ "before": "Tu ", "after": " très bien !", "answer": "parles", "hint": "parler", "explain_vi": "vì sao thì này + vì sao dạng này" }]
>     }
>   }
> }
> ```
>
> Ràng buộc bắt buộc:
> - Key thì hợp lệ: `present, passe_compose, futur_proche, imparfait, futur_simple, plus_que_parfait, futur_anterieur, passe_simple, passe_anterieur, subj_present, subj_passe, subj_imparfait, subj_plus_que_parfait, cond_present, cond_passe`.
> - `forms` KHÔNG chứa đại từ, chỉ phần động từ (kể cả trợ động từ ở thì kép: `"ai parlé"`).
> - `category`: đúng 1 slug nhóm chia (nhom-er / nhom-ir / nhom-3), lấy từ seed/categories.mjs.
> - Động từ đi với être ở thì kép: forms theo giống đực, thêm `"alt"` cho dạng giống cái/số nhiều (xem mẫu aller trong seed/words.mjs).
> - Động từ PHẢN THÂN (se lever, s'appeler…): forms chứa cả đại từ phản thân, không chứa chủ ngữ (vd présent: `"me lève"`, `"te lèves"`…; passé composé dùng être: `"me suis levé"` + alt giống cái), và gắn slug `phan-than`.
> - Mỗi thì ≥ 2 cloze, mỗi câu PHẢI có **tín hiệu ngữ cảnh** để suy ra thì (hier, demain, avant, il faut que…) — không được là câu trần trụi.
> - `cloze.answer` phải trùng khớp chính xác một giá trị trong `forms` hoặc `alt`.
> - `explain_vi` giải thích tín hiệu → thì, bằng tiếng Việt, 1 câu.

## ③ Validate bằng máy — bắt lỗi cấu trúc

```bash
npm run validate content/2026-07-nau-an.json
```

Script chặn (error): thiếu field bắt buộc, key thì sai, forms thiếu ngôi, **cloze.answer không khớp forms/alt** (lỗi AI hay mắc nhất), word trùng lặp. Cảnh báo (warning): thiếu basics_vi, thiếu cloze (Level 2 không mở được), hint lệch word. Chỉ đi tiếp khi `✔ Đạt`.

## ④ Duyệt tay — người chỉ lo phần máy không lo được

Máy đã lo cấu trúc, nên chỉ đọc soát 3 thứ theo thứ tự tác hại:

1. **Bảng chia đúng không** — đối chiếu các động từ bất quy tắc với Le Conjugueur / Larousse. Sai forms là sai cả bài luyện.
2. **Câu cloze tự nhiên + tín hiệu rõ không** — người học phải suy ra được thì chỉ từ câu. Câu mơ hồ (2 thì đều đúng) phải sửa hoặc bỏ.
3. **Nghĩa tiếng Việt chuẩn không** — meaning_vi, explain_vi, bản dịch ví dụ.

## ⑤ Import

- **Batch mới / cập nhật lẻ**: POST `content/<file>.json` tới `/api/words/import` (header `x-api-key`) — upsert theo `word`, gửi lại bao nhiêu lần cũng an toàn, không cần đụng DB.
- **Làm lại từ đầu**: `truncate table public.words cascade;` rồi `npm run seed` (chỉ nạp 13 từ gốc trong `seed/words.mjs`) + import lại các batch trong `content/`.

## ⑥ Smoke test trong app

Mở word_detail của 1–2 từ mới (accordion, loa TTS, ví dụ) → luyện 1 vòng Level 1 + Level 2 → xem từ mới xuất hiện đúng section chủ đề ở Home. Xong mới commit file JSON vào git.

## Việc KHÔNG làm

- Không sửa dữ liệu trực tiếp trong Supabase Table Editor — sửa file rồi import lại, nếu không lần import sau sẽ ghi đè mất.
- Không import file chưa qua `npm run validate`.
- Không trộn nhiều chủ đề trong một file — mỗi batch một chủ đề, dễ review, dễ rollback.
