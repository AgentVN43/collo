-- Folask schema (mô hình quan hệ) — run in Supabase SQL Editor
-- Auth: email/password (disable "Confirm email" in Auth > Providers > Email)
--
-- Mô hình học 2 tầng: Từ đơn (words) -> Collocation (collocations), nối nhau qua
-- word_collocations (nhiều-nhiều, vì "school project" ghép từ CẢ school lẫn project).
--
-- DB đang chạy bản cũ (words.partnerships jsonb): chạy supabase/relational-migration.sql
-- thay vì file này.

-- ==================== DANH MỤC ====================

-- 7 loại collocation chuẩn (Oxford Collocations Dictionary). Category mô tả COLLOCATION,
-- không phải từ đơn: "pain" không phải adjective-noun, "excruciating pain" mới là.
create table if not exists public.categories (
  slug text primary key,
  name text not null unique,
  description text not null default '',
  sort_order int not null default 100
);

alter table public.categories enable row level security;

drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories
  for select using (true);

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

-- ==================== ADMIN ====================

create table if not exists public.admins (
  email text primary key
);

alter table public.admins enable row level security;

drop policy if exists "admins_self_read" on public.admins;
create policy "admins_self_read" on public.admins
  for select using (auth.jwt() ->> 'email' = email);

-- Nhớ thêm email của bạn:
-- insert into public.admins (email) values ('your-email@example.com') on conflict do nothing;

-- ==================== TỪ ĐƠN ====================

-- Từ đơn = đơn vị Level 1. KHÔNG có category (category thuộc về collocation).
create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  word text not null unique,
  word_type text not null default 'n.',
  meaning_vi text not null default '',
  meaning_en text not null default '',
  basics_vi text not null default '',
  -- flow duyệt content: draft → processing → published (archived = gỡ khỏi app)
  status text not null default 'draft' check (status in ('draft', 'processing', 'published', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.words enable row level security;

drop policy if exists "words_public_read" on public.words;
create policy "words_public_read" on public.words
  for select using (status = 'published');
-- writes từ client chỉ dành cho admin (policy bên dưới); pipeline import dùng service role

drop policy if exists "words_admin_read" on public.words;
create policy "words_admin_read" on public.words
  for select using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

drop policy if exists "words_admin_insert" on public.words;
create policy "words_admin_insert" on public.words
  for insert with check (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

drop policy if exists "words_admin_update" on public.words;
create policy "words_admin_update" on public.words
  for update using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

-- ==================== COLLOCATION ====================

-- Collocation = đơn vị Level 2. examples là mảng [{en, vi, pattern?}] — thuần hiển thị,
-- pattern là công thức ngữ pháp (vd "S+V+O") cho biết cụm đóng vai trò gì trong câu.
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

-- Nối nhiều-nhiều: 1 collocation gồm nhiều từ đơn, 1 từ đơn thuộc nhiều collocation.
-- Đây là bảng cho phép cơ chế "học thuộc các từ đơn → mở khoá collocation ghép từ chúng".
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

-- Sắc thái theo ngữ cảnh + hội thoại mẫu. conversation = [{speaker, text}].
create table if not exists public.collocation_variants (
  id uuid primary key default gen_random_uuid(),
  collocation_id uuid not null references public.collocations(id) on delete cascade,
  context text not null check (context in ('casual', 'formal', 'alternative')),
  text_variant text not null default '',
  conversation jsonb not null default '[]'::jsonb,
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

-- ==================== BÀI TẬP ====================

-- Một bảng cho MỌI dạng bài. Phần khác nhau giữa các dạng nằm trong payload jsonb:
--   fill_in          → {"before": "...", "after": "..."}
--   multiple_choice  → {"options": ["...", "..."]}
--   conversation_gap → {"turns": [{speaker,text}], "gap_index": 1}   (chưa dùng)
-- Thêm dạng mới = thêm giá trị vào check constraint, không cần đổi cấu trúc bảng.
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
  -- gắn vào ĐÚNG 1 trong hai: từ đơn (Level 1) hoặc collocation (Level 2)
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

-- ==================== BỘ SƯU TẬP ====================

-- Bộ sưu tập gom TỪ ĐƠN (không gom collocation).
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_public boolean not null default false,          -- placeholder phase sau
  allow_contributors boolean not null default false, -- placeholder phase sau
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.collections enable row level security;

drop policy if exists "collections_owner_all" on public.collections;
create policy "collections_owner_all" on public.collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.collection_words (
  collection_id uuid not null references public.collections(id) on delete cascade,
  word_id uuid not null references public.words(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, word_id)
);

alter table public.collection_words enable row level security;

drop policy if exists "collection_words_owner_all" on public.collection_words;
create policy "collection_words_owner_all" on public.collection_words
  for all
  using (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()));

-- ==================== TIẾN ĐỘ ====================

-- MỘT bảng cho cả hai tầng học, phân biệt bằng item_type:
--   'word'        → mastery từ đơn (Level 1); đạt >= 3 thì các collocation chứa từ này được mở khoá
--   'collocation' → mastery collocation (Level 2)
-- Không có FK tới words/collocations vì item_id trỏ tới hai bảng khác nhau tuỳ item_type.
create table if not exists public.progress (
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

-- ==================== AI CENTER ====================
-- Giữ nguyên từ bản trước. Lưu ý: /api/ai/run hiện TẠM NGƯNG (trả 503) vì logic merge cũ
-- viết cho cột words.partnerships đã bị bỏ. Bảng và UI giữ lại để dùng lại sau.

-- Provider AI: chứa API key → TUYỆT ĐỐI không có policy client (kể cả admin).
-- Mọi thao tác qua /api/ai/providers (service role, kiểm tra admin server-side).
create table if not exists public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_url text not null,            -- endpoint chat-completions đầy đủ (OpenAI-compatible)
  model text not null default '',
  api_key text not null default '',
  headers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.ai_providers enable row level security;
-- (không tạo policy nào — RLS chặn toàn bộ client)

create table if not exists public.ai_prompts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  task_type text not null check (task_type in ('word_full', 'word_theory')),
  template text not null default '',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ai_prompts enable row level security;
drop policy if exists "ai_prompts_admin_all" on public.ai_prompts;
create policy "ai_prompts_admin_all" on public.ai_prompts
  for all
  using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

create table if not exists public.ai_tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  task_type text not null check (task_type in ('word_full', 'word_theory')),
  prompt_id uuid not null references public.ai_prompts(id) on delete cascade,
  provider_id uuid not null references public.ai_providers(id) on delete cascade,
  -- {"cycle":"manual"} hoặc {"cycle":"daily","hour":3,"minute":0} — cron bật ở phase sau
  schedule jsonb not null default '{"cycle":"manual"}'::jsonb,
  enabled boolean not null default true,
  last_run_at timestamptz,
  last_status text,
  created_at timestamptz not null default now()
);
alter table public.ai_tasks enable row level security;
drop policy if exists "ai_tasks_admin_all" on public.ai_tasks;
create policy "ai_tasks_admin_all" on public.ai_tasks
  for all
  using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

-- Log từng lần chạy — client (admin) chỉ đọc; ghi bằng service role
create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.ai_tasks(id) on delete cascade,
  word_id uuid references public.words(id) on delete set null,
  word text not null default '',
  status text not null default 'running' check (status in ('running', 'success', 'failed')),
  input text not null default '',
  output text not null default '',
  error text not null default '',
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.ai_runs enable row level security;
drop policy if exists "ai_runs_admin_read" on public.ai_runs;
create policy "ai_runs_admin_read" on public.ai_runs
  for select using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));
