-- ====================================================================
-- Migration: gom collocation theo Ý ĐỊNH GIAO TIẾP (Intent)
-- Chạy TOÀN BỘ file này 1 lần trong Supabase SQL Editor.
-- Tiền đề: đã chạy relational-migration.sql.
--
-- VÌ SAO ĐỔI:
-- Bảng collocation_variants cũ mang tên "biến thể của cụm" nhưng thực tế lưu
-- NHỮNG COLLOCATION KHÁC cùng diễn đạt một ý (17/20 dòng không hề chứa chunk gốc):
--   "fall behind schedule" -> variants: "slipping on deadlines", "running late on this"
-- Những cụm đó là collocation hạng nhất nhưng bị chôn thành text: không luyện được,
-- không nối được với từ đơn, không tra cứu được.
--
-- MÔ HÌNH MỚI: intent là cái hộp, các cách nói là anh em ngang hàng bên trong.
--   Intent "báo dự án chậm tiến độ"
--     ├─ fall behind schedule    [formal]
--     └─ running late on this    [casual]
-- register (formal/casual) trở thành THUỘC TÍNH của collocation, không phải hộp chứa.
-- "alternative" bị bỏ: nó chưa bao giờ là một register, mà chính là ý nghĩa của intent.
--
-- ⚠️  XOÁ SẠCH DỮ LIỆU NỘI DUNG (đã thống nhất — nội dung cũ soạn lại từ đầu):
--     words, collocations, word_collocations, collocation_variants, exercises, progress.
--     Tài khoản, admins, categories, collections (khung) được giữ.
-- ====================================================================

-- ---------- 1. Dọn sạch nội dung cũ ----------
-- collection_words / word_collocations / exercises / variants đều ON DELETE CASCADE
-- theo words & collocations nên truncate hai bảng gốc là đủ.
truncate table public.words cascade;
truncate table public.collocations cascade;
-- progress không có FK (item_id trỏ 2 bảng khác nhau tuỳ item_type) nên phải dọn tay,
-- nếu không sẽ còn tiến độ trỏ tới id đã biến mất.
truncate table public.progress;

-- ---------- 2. Category thứ 8: other ----------
-- Cách nói cấp câu ("It hurts like crazy") không thuộc 7 loại collocation chuẩn,
-- nhưng vẫn cần lưu để dạy sắc thái casual → gom hết vào 'other'.
insert into public.categories (slug, name, sort_order, description) values
  ('other', 'Other', 99,
   'Cách nói không thuộc 7 loại collocation chuẩn: câu hoàn chỉnh, thành ngữ, cụm khẩu ngữ. Thường là biến thể casual của một ý định.')
on conflict (slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  description = excluded.description;

-- ---------- 3. Bảng intents ----------
-- Một ý định giao tiếp = một điều người học muốn NÓI. Các cách nói khác nhau
-- (khác register) nằm dưới nó dưới dạng collocation.
create table if not exists public.intents (
  id uuid primary key default gen_random_uuid(),
  name_vi text not null unique,        -- "báo dự án đang chậm tiến độ"
  description_vi text not null default '',
  situation text not null default '',  -- bối cảnh/chủ đề batch, để nhóm và tra cứu
  status text not null default 'draft' check (status in ('draft', 'processing', 'published', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.intents enable row level security;

drop policy if exists "intents_public_read" on public.intents;
create policy "intents_public_read" on public.intents
  for select using (status = 'published');

drop policy if exists "intents_admin_read" on public.intents;
create policy "intents_admin_read" on public.intents
  for select using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

drop policy if exists "intents_admin_insert" on public.intents;
create policy "intents_admin_insert" on public.intents
  for insert with check (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

drop policy if exists "intents_admin_update" on public.intents;
create policy "intents_admin_update" on public.intents
  for update using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

-- ---------- 4. collocations: thêm intent_id, register, conversation ----------
alter table public.collocations
  add column if not exists intent_id uuid references public.intents(id) on delete set null;

-- register: chỉ 2 mức dùng thật
--   formal = email, báo cáo, nói với khách/sếp
--   casual = trò chuyện, nhắn tin Slack/Zalo/Viber hằng ngày
alter table public.collocations
  add column if not exists register text not null default 'formal'
  check (register in ('formal', 'casual'));

-- Hội thoại mẫu chuyển từ collocation_variants về chính collocation:
-- mỗi cách nói tự minh hoạ bằng một đoạn thoại ngắn. [{speaker, text}]
alter table public.collocations
  add column if not exists conversation jsonb not null default '[]'::jsonb;

create index if not exists collocations_intent_idx on public.collocations (intent_id);

-- ---------- 5. Bỏ bảng variants ----------
drop table if exists public.collocation_variants;

-- ---------- 6. Xong ----------
-- Soạn nội dung: POST /api/words/import với JSON lồng theo intent
-- { "intent": "...", "collocations": [{ "chunk": "...", "register": "formal", ... }] }
-- Xem docs/test-import-body.json làm mẫu.
