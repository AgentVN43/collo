-- Feedback từ người dùng về nội dung từ vựng

create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references public.words(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('basics', 'conjugation', 'multiple')),
  content text not null,
  status text not null default 'new' check (status in ('new', 'wip', 'done')),
  created_at timestamptz not null default now()
);

alter table public.feedbacks enable row level security;

-- User chỉ được tạo feedback, không đọc/sửa/xóa
drop policy if exists "feedbacks_user_insert" on public.feedbacks;
create policy "feedbacks_user_insert" on public.feedbacks
  for insert with check (auth.uid() = user_id);

-- Admin đọc và cập nhật status
drop policy if exists "feedbacks_admin_read" on public.feedbacks;
create policy "feedbacks_admin_read" on public.feedbacks
  for select using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

drop policy if exists "feedbacks_admin_update" on public.feedbacks;
create policy "feedbacks_admin_update" on public.feedbacks
  for update using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));
