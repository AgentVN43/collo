-- ====================================================================
-- TIỆN ÍCH TEST: xoá sạch nội dung để import lại từ đầu
--
-- ⚠️  XOÁ KHÔNG KHÔI PHỤC ĐƯỢC. Chạy khi muốn làm lại một vòng test sạch.
--
-- BỊ XOÁ:
--   intents             ý định giao tiếp
--   collocations        các cách nói
--   words               từ đơn
--   word_collocations   liên kết từ ↔ cách nói   (tự xoá theo cascade)
--   exercises           bài tập                   (tự xoá theo cascade)
--   collection_words    từ trong bộ sưu tập       (tự xoá theo cascade)
--   progress            tiến độ học của mọi user  (không có FK nên phải xoá tay)
--
-- ĐƯỢC GIỮ:
--   auth.users, admins, categories (8 loại), collections (khung bộ sưu tập, rỗng đi),
--   feedbacks, và toàn bộ bảng ai_*.
--
-- Vì sao xoá cả progress: progress.item_id trỏ tới words/collocations nhưng KHÔNG có
-- khoá ngoại (item_type quyết định nó trỏ bảng nào). Không dọn thì sẽ còn tiến độ mồ côi
-- trỏ tới id đã biến mất, gây số liệu sai ở màn Progress.
-- ====================================================================

-- truncate ... cascade tự lan sang các bảng có khoá ngoại trỏ vào 3 bảng này
-- (word_collocations, exercises, collection_words).
truncate table public.words, public.collocations, public.intents cascade;

truncate table public.progress;

-- Bỏ comment dòng dưới nếu muốn xoá luôn các bộ sưu tập rỗng còn sót lại:
-- truncate table public.collections cascade;

-- Bỏ comment nếu muốn xoá luôn góp ý của người dùng:
-- truncate table public.feedbacks;

-- ---------- Kiểm tra sau khi xoá (mọi số phải bằng 0, trừ categories = 8) ----------
select 'intents' as bang, count(*) as con_lai from public.intents
union all select 'collocations',      count(*) from public.collocations
union all select 'words',             count(*) from public.words
union all select 'word_collocations', count(*) from public.word_collocations
union all select 'exercises',         count(*) from public.exercises
union all select 'progress',          count(*) from public.progress
union all select 'collection_words',  count(*) from public.collection_words
union all select 'categories (giữ)',  count(*) from public.categories
order by bang;
