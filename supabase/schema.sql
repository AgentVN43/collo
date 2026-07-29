-- Folask MVP schema — run in Supabase SQL Editor
-- Auth: email/password (disable "Confirm email" in Auth > Providers > Email)

-- Danh mục category: mỗi từ thuộc ĐÚNG 1 (nhóm chia theo présent: -er / -ir / nhóm 3).
-- Home nhóm section theo category; quản lý qua seed/categories.mjs.
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

create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  word text not null unique,
  word_type text not null default 'v.',
  category_slug text references public.categories(slug),
  meaning_vi text not null,
  meaning_en text not null,
  basics_vi text not null default '',
  conjugations jsonb not null default '{}'::jsonb,
  -- flow duyệt content: draft → processing → published (archived = gỡ khỏi app)
  status text not null default 'draft' check (status in ('draft', 'processing', 'published', 'archived')),
  created_at timestamptz not null default now()
);

-- Migration cho DB đang chạy: cập nhật check constraint để thêm 'processing'
-- alter table public.words drop constraint if exists words_status_check;
-- alter table public.words add constraint words_status_check
--   check (status in ('draft', 'processing', 'published', 'archived'));

alter table public.words enable row level security;

drop policy if exists "words_public_read" on public.words;
create policy "words_public_read" on public.words
  for select using (status = 'published');
-- writes từ client chỉ dành cho admin (policy bên dưới); pipeline dùng service role

-- Danh sách admin (email đăng nhập) — cấp quyền Admin Dashboard
create table if not exists public.admins (
  email text primary key
);

alter table public.admins enable row level security;

drop policy if exists "admins_self_read" on public.admins;
create policy "admins_self_read" on public.admins
  for select using (auth.jwt() ->> 'email' = email);

-- Nhớ thêm email của bạn:
-- insert into public.admins (email) values ('your-email@example.com') on conflict do nothing;

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

-- Bộ sưu tập từ vựng của người học (thay cho wishlist phẳng)
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

-- Migration từ wishlist cũ (chạy sau khi tạo 2 bảng trên, nếu DB đang có wishlist):
-- insert into public.collections (user_id, name)
--   select distinct user_id, 'Yêu thích' from public.wishlist;
-- insert into public.collection_words (collection_id, word_id, added_at)
--   select c.id, w.word_id, w.created_at
--   from public.wishlist w join public.collections c on c.user_id = w.user_id and c.name = 'Yêu thích';
-- drop table public.wishlist;

create table if not exists public.progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null references public.words(id) on delete cascade,
  tense text not null,
  level int not null default 1,
  attempts int not null default 0,
  fails int not null default 0,
  near_misses int not null default 0,
  mastery int not null default 0 check (mastery between 0 and 5),
  last_practiced timestamptz,
  next_due date,
  primary key (user_id, word_id, tense, level)
);

alter table public.progress enable row level security;

drop policy if exists "progress_owner_all" on public.progress;
create policy "progress_owner_all" on public.progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ==================== AI CENTER ====================

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
