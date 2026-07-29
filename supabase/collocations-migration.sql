-- ====================================================================
-- Pivot Folask: French conjugation -> English Word Partnerships/Collocations
-- Chạy TOÀN BỘ file này 1 lần trong Supabase SQL Editor, sau schema.sql/feedbacks.sql.
--
-- Lưu ý: đây là file THAY THẾ cho seed/words.mjs + seed/categories.mjs (không đụng
-- tới 2 file đó) — quản lý category + từ mới trực tiếp bằng SQL từ đây trở đi.
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

-- 3. Category mới: đúng 3 loại collocation (thay cho nhom-er / nhom-ir / nhom-3).
-- Category cũ được GIỮ NGUYÊN (không xoá) để không phá vỡ các dòng words cũ còn tham
-- chiếu tới — bỏ comment khối delete bên dưới nếu bạn muốn dọn sạch (sau khi đã xoá/di
-- chuyển hết words trỏ tới slug cũ).
insert into public.categories (slug, name, sort_order, description) values
  ('word-partnership', 'Word Partnership', 1,
   'Giới từ/tiểu từ cố định đi kèm 1 headword, vd sync: in sync (with), out of sync (with), sync with / sync to.'),
  ('verb-noun', 'Verb + Noun Collocation', 2,
   'Cụm động từ + danh từ mô tả hành động kỹ thuật, đóng vai trò Object trong câu (S+V+O), vd resolve a bug.'),
  ('adjective-noun', 'Adjective + Noun Collocation', 3,
   'Cụm tính từ + danh từ mô tả hệ thống, đóng vai trò Complement, vd scalable architecture.')
on conflict (slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  description = excluded.description;

-- Dọn category tiếng Pháp cũ (CHỈ chạy sau khi không còn word nào trỏ tới các slug này):
-- delete from public.categories where slug in ('nhom-er', 'nhom-ir', 'nhom-3');

-- 4. Mẫu word — copy các khối insert dưới đây làm template khi tự soạn từ mới bằng SQL.
--    Mỗi phần tử trong "partnerships" khớp đúng shape PartnershipItem (src/lib/types.ts):
--    { key, phrase, meaning_vi, rule_vi, alt?, examples: [{en, vi, pattern?}], cloze: [{before, after, answer, alt?, hint, explain_vi, pattern?}] }

insert into public.words (word, word_type, category_slug, meaning_vi, meaning_en, basics_vi, partnerships, status)
values (
  'sync', 'v.', 'word-partnership',
  'đồng bộ', 'to make things consistent with each other',
  'Sync đi với nhiều giới từ khác nhau tuỳ trạng thái: "in sync (with)" khi đã khớp, "out of sync (with)" khi bị lệch, "sync with/to" khi thực hiện hành động đồng bộ.',
  '[
    {
      "key": "in_sync_with",
      "phrase": "in sync (with)",
      "meaning_vi": "đồng bộ, khớp (với)",
      "rule_vi": "Tính từ ghép, dùng sau \"be\" để mô tả trạng thái đã đồng bộ.",
      "alt": [],
      "examples": [
        {"en": "The frontend is finally in sync with the backend.", "vi": "Frontend cuối cùng đã đồng bộ với backend.", "pattern": "S+V+C"}
      ],
      "cloze": [
        {"before": "After the merge, both branches were ", "after": " each other.", "answer": "in sync with", "hint": "sync", "explain_vi": "Trạng thái đã đồng bộ xong nên dùng \"in sync with\".", "pattern": "S+V+C"}
      ]
    },
    {
      "key": "out_of_sync_with",
      "phrase": "out of sync (with)",
      "meaning_vi": "lệch, không khớp (với)",
      "rule_vi": "Ngược nghĩa với \"in sync\" — dùng khi có sự lệch pha/không khớp.",
      "alt": [],
      "examples": [
        {"en": "The client cache was out of sync with the server.", "vi": "Cache của client bị lệch so với server.", "pattern": "S+V+C"}
      ],
      "cloze": [
        {"before": "The two databases went ", "after": " after the outage.", "answer": "out of sync", "hint": "sync", "explain_vi": "Sau sự cố, dữ liệu bị lệch nên dùng \"out of sync\".", "pattern": "S+V+C"}
      ]
    },
    {
      "key": "sync_with_to",
      "phrase": "sync with / sync to",
      "meaning_vi": "đồng bộ với/vào",
      "rule_vi": "Động từ + giới từ: \"sync with\" (đồng bộ hai chiều), \"sync to\" (đồng bộ vào một nguồn duy nhất).",
      "alt": ["sync with", "sync to"],
      "examples": [
        {"en": "Please sync your phone with the cloud.", "vi": "Hãy đồng bộ điện thoại của bạn với đám mây.", "pattern": "S+V+O"}
      ],
      "cloze": [
        {"before": "Remember to ", "after": " the cloud before you leave.", "answer": "sync to", "hint": "sync", "explain_vi": "Đồng bộ VÀO một nguồn duy nhất dùng \"sync to\".", "pattern": "S+V+O"}
      ]
    }
  ]'::jsonb,
  'draft'
)
on conflict (word) do nothing;

insert into public.words (word, word_type, category_slug, meaning_vi, meaning_en, basics_vi, partnerships, status)
values (
  'resolve', 'v.', 'verb-noun',
  'khắc phục, giải quyết', 'to fix or settle something',
  'Verb + Noun collocation phổ biến trong ngữ cảnh kỹ thuật: resolve đi với bug/issue/conflict, đóng vai trò Object trong câu S+V+O.',
  '[
    {
      "key": "resolve_a_bug",
      "phrase": "resolve a bug",
      "meaning_vi": "khắc phục một lỗi",
      "rule_vi": "Verb + Noun collocation: resolve + bug/issue trong ngữ cảnh kỹ thuật, đóng vai trò Object.",
      "alt": [],
      "examples": [
        {"en": "I resolve a critical bug before every release.", "vi": "Tôi khắc phục một lỗi nghiêm trọng trước mỗi lần phát hành.", "pattern": "S+V+O"}
      ],
      "cloze": [
        {"before": "The team worked overtime to ", "after": " before the deadline.", "answer": "resolve a bug", "hint": "resolve", "explain_vi": "Hành động khắc phục lỗi kỹ thuật dùng collocation \"resolve a bug\".", "pattern": "S+V+O"}
      ]
    },
    {
      "key": "resolve_a_conflict",
      "phrase": "resolve a conflict",
      "meaning_vi": "giải quyết xung đột",
      "rule_vi": "Cùng nhóm Verb + Noun, dùng khi có mâu thuẫn/xung đột (vd merge conflict, xung đột giữa người dùng).",
      "alt": [],
      "examples": [
        {"en": "We need to resolve a merge conflict before deploying.", "vi": "Chúng tôi cần giải quyết xung đột merge trước khi deploy.", "pattern": "S+V+O"}
      ],
      "cloze": [
        {"before": "Please ", "after": " in this pull request first.", "answer": "resolve a conflict", "hint": "resolve", "explain_vi": "Giải quyết mâu thuẫn trong code dùng \"resolve a conflict\".", "pattern": "S+V+O"}
      ]
    }
  ]'::jsonb,
  'draft'
)
on conflict (word) do nothing;

insert into public.words (word, word_type, category_slug, meaning_vi, meaning_en, basics_vi, partnerships, status)
values (
  'scalable', 'adj.', 'adjective-noun',
  'có khả năng mở rộng', 'able to handle growth without breaking',
  'Adjective + Noun collocation mô tả hệ thống — scalable đi với architecture/solution/system khi hệ thống chịu tải tăng tốt.',
  '[
    {
      "key": "scalable_architecture",
      "phrase": "scalable architecture",
      "meaning_vi": "kiến trúc có khả năng mở rộng",
      "rule_vi": "Adjective + Noun collocation, thường đóng vai trò Complement/Object mô tả hệ thống.",
      "alt": [],
      "examples": [
        {"en": "We redesigned the system with a scalable architecture.", "vi": "Chúng tôi thiết kế lại hệ thống với kiến trúc có khả năng mở rộng.", "pattern": "S+V+O"}
      ],
      "cloze": [
        {"before": "The startup needed a ", "after": " to handle rapid growth.", "answer": "scalable architecture", "hint": "scalable", "explain_vi": "Mô tả hệ thống chịu tải tăng dùng \"scalable architecture\".", "pattern": "S+V+O"}
      ]
    },
    {
      "key": "scalable_solution",
      "phrase": "scalable solution",
      "meaning_vi": "giải pháp có khả năng mở rộng",
      "rule_vi": "Cùng nhóm Adjective + Noun, dùng khi nói về giải pháp/phương án nói chung thay vì kiến trúc cụ thể.",
      "alt": [],
      "examples": [
        {"en": "This caching layer is a scalable solution for high traffic.", "vi": "Lớp cache này là một giải pháp có khả năng mở rộng cho lưu lượng cao.", "pattern": "S+V+C"}
      ],
      "cloze": [
        {"before": "They proposed a ", "after": " instead of a quick patch.", "answer": "scalable solution", "hint": "scalable", "explain_vi": "Nói về giải pháp bền vững cho tăng trưởng dùng \"scalable solution\".", "pattern": "S+V+C"}
      ]
    }
  ]'::jsonb,
  'draft'
)
on conflict (word) do nothing;

-- Các từ trên được tạo ở status 'draft' — vào /admin để chọn category (đã set sẵn),
-- kiểm tra nội dung rồi publish, giống quy trình duyệt từ hiện có.
