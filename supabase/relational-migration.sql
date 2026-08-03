-- ====================================================================
-- Migration: collocation từ jsonb (words.partnerships) -> mô hình quan hệ
-- Chạy TOÀN BỘ file này 1 lần trong Supabase SQL Editor.
-- Tiền đề: DB đã chạy schema.sql (bản cũ) + collocations-migration.sql.
--
-- ⚠️  MẤT DỮ LIỆU CÓ CHỦ ĐÍCH:
--   1. Cột words.partnerships bị XOÁ — mọi collocation đang nằm trong đó sẽ mất.
--      Nếu còn nội dung cần giữ, export ra JSON TRƯỚC khi chạy:
--        select word, partnerships from public.words where partnerships <> '[]'::jsonb;
--      rồi import lại qua POST /api/words/import sau khi migrate xong.
--   2. Bảng progress bị DROP + tạo lại — khoá chính đổi hoàn toàn
--      (partnership_key/level -> item_type/item_id). Toàn bộ tiến độ cũ mất.
--   3. Cột words.category_slug bị XOÁ — category giờ thuộc về collocation.
-- ====================================================================

-- ---------- 1. Category: đảm bảo đủ 7 loại chuẩn ----------
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

-- ---------- 2. words: gỡ phần nội dung collocation ----------
-- category_slug phải bỏ TRƯỚC khi xoá category cũ (nó đang tham chiếu FK).
alter table public.words drop column if exists partnerships;
alter table public.words drop column if exists category_slug;
alter table public.words alter column word_type set default 'n.';
alter table public.words alter column meaning_vi set default '';
alter table public.words alter column meaning_en set default '';

-- Giờ mới dọn được category tiếng Pháp cũ + slug nháp
delete from public.categories where slug in ('nhom-er', 'nhom-ir', 'nhom-3', 'word-partnership');

-- ---------- 3. collocations ----------
create table if not exists public.collocations (
  id uuid primary key default gen_random_uuid(),
  chunk text not null unique,
  literal_meaning text not null default '',
  category_slug text references public.categories(slug),
  note_vi text not null default '',
  examples jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'processing', 'published', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.collocations enable row level security;

drop policy if exists "collocations_public_read" on public.collocations;
create policy "collocations_public_read" on public.collocations
  for select using (status = 'published');

drop policy if exists "collocations_admin_read" on public.collocations;
create policy "collocations_admin_read" on public.collocations
  for select using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

drop policy if exists "collocations_admin_insert" on public.collocations;
create policy "collocations_admin_insert" on public.collocations
  for insert with check (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

drop policy if exists "collocations_admin_update" on public.collocations;
create policy "collocations_admin_update" on public.collocations
  for update using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

-- ---------- 4. word_collocations (nhiều-nhiều) ----------
create table if not exists public.word_collocations (
  word_id uuid not null references public.words(id) on delete cascade,
  collocation_id uuid not null references public.collocations(id) on delete cascade,
  primary key (word_id, collocation_id)
);

create index if not exists word_collocations_collocation_idx
  on public.word_collocations (collocation_id);

alter table public.word_collocations enable row level security;

drop policy if exists "word_collocations_public_read" on public.word_collocations;
create policy "word_collocations_public_read" on public.word_collocations
  for select
  using (exists (select 1 from public.collocations c where c.id = collocation_id and c.status = 'published'));

drop policy if exists "word_collocations_admin_all" on public.word_collocations;
create policy "word_collocations_admin_all" on public.word_collocations
  for all
  using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

-- ---------- 5. collocation_variants (casual/formal/alternative + hội thoại) ----------
create table if not exists public.collocation_variants (
  id uuid primary key default gen_random_uuid(),
  collocation_id uuid not null references public.collocations(id) on delete cascade,
  context text not null check (context in ('casual', 'formal', 'alternative')),
  text_variant text not null default '',
  conversation jsonb not null default '[]'::jsonb,   -- [{speaker, text}]
  sort_order int not null default 0
);

create index if not exists collocation_variants_collocation_idx
  on public.collocation_variants (collocation_id);

alter table public.collocation_variants enable row level security;

drop policy if exists "collocation_variants_public_read" on public.collocation_variants;
create policy "collocation_variants_public_read" on public.collocation_variants
  for select
  using (exists (select 1 from public.collocations c where c.id = collocation_id and c.status = 'published'));

drop policy if exists "collocation_variants_admin_all" on public.collocation_variants;
create policy "collocation_variants_admin_all" on public.collocation_variants
  for all
  using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

-- ---------- 6. exercises (mọi dạng bài, payload theo type) ----------
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  word_id uuid references public.words(id) on delete cascade,
  collocation_id uuid references public.collocations(id) on delete cascade,
  type text not null check (type in ('fill_in', 'multiple_choice', 'conversation_gap')),
  prompt text not null default '',
  answer text not null default '',
  alt text[] not null default '{}',
  explain_vi text not null default '',
  pattern text not null default '',
  payload jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  constraint exercises_one_owner check (num_nonnulls(word_id, collocation_id) = 1)
);

create index if not exists exercises_word_idx on public.exercises (word_id);
create index if not exists exercises_collocation_idx on public.exercises (collocation_id);

alter table public.exercises enable row level security;

drop policy if exists "exercises_public_read" on public.exercises;
create policy "exercises_public_read" on public.exercises
  for select using (
    exists (select 1 from public.words w where w.id = word_id and w.status = 'published')
    or exists (select 1 from public.collocations c where c.id = collocation_id and c.status = 'published')
  );

drop policy if exists "exercises_admin_all" on public.exercises;
create policy "exercises_admin_all" on public.exercises
  for all
  using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

-- ---------- 7. progress: khoá chính đổi -> drop & tạo lại ----------
drop table if exists public.progress;

create table public.progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('word', 'collocation')),
  item_id uuid not null,
  attempts int not null default 0,
  fails int not null default 0,
  near_misses int not null default 0,
  mastery int not null default 0 check (mastery between 0 and 5),
  last_practiced timestamptz,
  next_due date,
  primary key (user_id, item_type, item_id)
);

alter table public.progress enable row level security;

drop policy if exists "progress_owner_all" on public.progress;
create policy "progress_owner_all" on public.progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- 8. Xong ----------
-- Soạn nội dung: POST /api/words/import (header x-api-key) với JSON lồng nhau
-- { word, meaning_vi, ..., collocations: [{ chunk, category, variants: [...], exercises: [...] }] }
-- Xem docs/test-import-body.json làm mẫu.
--
-- Lưu ý: /api/ai/run tạm ngưng (trả 503) vì logic merge cũ viết cho words.partnerships.
-- Các bảng ai_* và trang /admin/ai giữ nguyên, không bị migration này đụng tới.
