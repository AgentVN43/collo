-- ====================================================================
-- TIỆN ÍCH TEST: đẩy toàn bộ nội dung sang trạng thái 'published'
--
-- Dùng khi import với status 'draft' rồi muốn xem ngay trong app mà không phải
-- bấm duyệt từng mục trong /admin.
--
-- Nhắc: app học chỉ đọc bản ghi 'published' (RLS words_public_read,
-- collocations_public_read, intents_public_read). Nội dung draft vẫn hiện trong
-- /admin vì tài khoản admin có policy đọc mọi status.
--
-- An toàn: chỉ đổi cột status, không đụng nội dung. Chạy lại nhiều lần vô hại.
-- ====================================================================

with pub_intents as (
  update public.intents
     set status = 'published'
   where status <> 'published'
  returning 1
),
pub_collocations as (
  update public.collocations
     set status = 'published'
   where status <> 'published'
  returning 1
),
pub_words as (
  update public.words
     set status = 'published'
   where status <> 'published'
  returning 1
)
select
  (select count(*) from pub_intents)      as intents_da_publish,
  (select count(*) from pub_collocations) as collocations_da_publish,
  (select count(*) from pub_words)        as words_da_publish;

-- Xem lại kết quả cuối cùng
select 'intents' as bang, status, count(*) as so_luong from public.intents group by status
union all
select 'collocations', status, count(*) from public.collocations group by status
union all
select 'words', status, count(*) from public.words group by status
order by bang, status;
