-- ====================================================================
-- Pivot Folask: French conjugation -> English Collocations
-- Chạy TOÀN BỘ file này 1 lần trong Supabase SQL Editor, sau schema.sql/feedbacks.sql.
--
-- Lưu ý: đây là file THAY THẾ cho seed/words.mjs + seed/categories.mjs (không đụng
-- tới 2 file đó) — quản lý category + từ mới trực tiếp bằng SQL/import API từ đây.
-- `npm run seed` / `npm run validate` vẫn tham chiếu shape cũ (conjugations/tense) nên
-- sẽ không còn chạy đúng sau migration này — đây là chủ đích, không phải lỗi.
-- ====================================================================

-- 1. Đổi tên cột nội dung: conjugations (object theo thì) -> partnerships (mảng cụm từ)
alter table public.words rename column conjugations to partnerships;
alter table public.words alter column partnerships set default '[]'::jsonb;

-- Các dòng từ cũ (13 từ tiếng Pháp seed) đang có giá trị '{}'::jsonb (object rỗng) —
-- sai shape so với mảng mới, dọn lại để tránh lỗi .map() ở frontend.
update public.words set partnerships = '[]'::jsonb where jsonb_typeof(partnerships) <> 'array';

-- 2. Đổi tên cột progress: tense -> partnership_key (khóa chính đi theo tự động)
alter table public.progress rename column tense to partnership_key;

-- 3. Category = đúng 7 loại collocation chuẩn (Oxford Collocations Dictionary),
-- thay cho cả bộ category tiếng Pháp cũ (nhom-er/nhom-ir/nhom-3) lẫn bản nháp
-- "word-partnership" trước đó (không phải 1 loại collocation thật, đã bỏ).
insert into public.categories (slug, name, sort_order, description) values
  ('adverb-adjective', 'Adverb + Adjective', 1,
   'Trạng từ bổ nghĩa cho tính từ, vd: completely satisfied (KHÔNG dùng "downright satisfied").'),
  ('adjective-noun', 'Adjective + Noun', 2,
   'Tính từ bổ nghĩa cho danh từ, vd: excruciating pain (KHÔNG dùng "excruciating joy").'),
  ('noun-noun', 'Noun + Noun', 3,
   'Danh từ đi kèm danh từ (thường qua "of"), vd: a surge of anger (KHÔNG dùng "a rush of anger").'),
  ('noun-verb', 'Noun + Verb', 4,
   'Danh từ làm chủ ngữ cho 1 động từ đặc trưng, vd: lions roar (KHÔNG dùng "lions shout").'),
  ('verb-noun', 'Verb + Noun', 5,
   'Động từ + tân ngữ danh từ, vd: commit suicide (KHÔNG dùng "undertake suicide").'),
  ('verb-preposition', 'Verb + Expression with Preposition', 6,
   'Động từ + cụm giới từ cố định, vd: burst into tears (KHÔNG dùng "blow up in tears").'),
  ('verb-adverb', 'Verb + Adverb', 7,
   'Động từ bổ nghĩa bởi trạng từ đặc trưng, vd: wave frantically (KHÔNG dùng "wave feverishly").')
on conflict (slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  description = excluded.description;

-- Dọn category nháp "word-partnership" (không phải 1 trong 7 loại chuẩn) — an toàn
-- chạy dù chưa từng insert nó (no-op nếu không tồn tại).
delete from public.categories where slug = 'word-partnership';

-- Dọn category tiếng Pháp cũ (CHỈ chạy sau khi không còn word nào trỏ tới các slug này):
-- delete from public.categories where slug in ('nhom-er', 'nhom-ir', 'nhom-3');

-- 4. Soạn từ mới: dùng "/api/words/import" (xem README) hoặc insert thẳng vào
-- "public.words" — cột "partnerships" là mảng jsonb, mỗi phần tử khớp shape
-- PartnershipItem (src/lib/types.ts): { key, phrase, meaning_vi, rule_vi, alt?,
-- examples: [{en, vi, pattern?}], cloze: [{before, after, answer, alt?, hint, explain_vi, pattern?}] }.
