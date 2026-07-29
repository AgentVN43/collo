# Prompt giao cho AI agent tạo content

> **Nếu có file RTF từ Le Conjugueur** (nguồn bảng chia chuẩn): dùng **chế độ ĐIỀN SKELETON**
> ở cuối file này thay vì prompt tạo mới — AI sẽ không phải tự chia thì, loại bỏ hoàn toàn
> rủi ro sai forms. Tạo skeleton bằng:
> `npm run parse:rtf <file.rtf hoặc thư-mục> -- -o content/skeleton.json`

Cách dùng: điền 3 chỗ `<<...>>` ở đầu, copy TOÀN BỘ phần trong khối dưới đây dán vào AI agent
(ChatGPT / Gemini / Claude...), lưu output thành `content/<ten-batch>.json`, rồi chạy
`npm run validate content/<ten-batch>.json`. Nếu có lỗi → dán nguyên danh sách lỗi lại cho
agent kèm câu "Sửa các lỗi sau và trả lại toàn bộ JSON". Lặp đến khi `✔ Đạt`.

---

```text
Bạn là chuyên gia ngữ pháp tiếng Pháp kiêm giáo viên dạy người Việt. Nhiệm vụ: tạo dữ liệu
JSON cho app luyện chia động từ tiếng Pháp (người học là người Việt, giải thích bằng tiếng Việt).

## Đầu vào
- Động từ cần tạo: <<DANH SÁCH ĐỘNG TỪ, vd: parler, habiter, aimer>>
- Các thì cần tạo: <<DANH SÁCH THÌ, vd: present, passe_compose, futur_proche>>

## Đầu ra
CHỈ trả về một MẢNG JSON hợp lệ (không markdown, không lời dẫn, không ``` fence).
Mỗi động từ là một object theo đúng schema sau, không thêm field lạ:

{
  "word": "parler",
  "word_type": "v.",
  "category": "nhom-er",
  "meaning_vi": "nói chuyện",
  "meaning_en": "to speak",
  "basics_vi": "2-3 câu tiếng Việt: nhóm động từ (-er/-ir/nhóm 3), trợ động từ ở thì kép (avoir hay être), ngoại lệ đáng nhớ nếu có.",
  "conjugations": {
    "present": {
      "rule_vi": "Quy tắc chia bằng tiếng Việt, 1-2 câu, nêu gốc chia.",
      "forms": { "j": "parle", "tu": "parles", "il_elle": "parle", "nous": "parlons", "vous": "parlez", "elles": "parlent" },
      "examples": [{ "fr": "Je parle un peu français.", "vi": "Tôi nói được một chút tiếng Pháp." }],
      "cloze": [
        { "before": "Tu ", "after": " très bien français !", "answer": "parles", "hint": "parler", "explain_vi": "Khen ở hiện tại → présent. Tu + -es: parles." },
        { "before": "Nous ", "after": " ensemble tous les jours.", "answer": "parlons", "hint": "parler", "explain_vi": "\"Tous les jours\" = thói quen → présent. Nous + -ons: parlons." }
      ]
    }
  }
}

## Ràng buộc BẮT BUỘC (dữ liệu sẽ bị máy kiểm tra tự động, sai là bị trả lại)

1. Key thì chỉ được nằm trong danh sách:
   present, passe_compose, futur_proche, imparfait, futur_simple, plus_que_parfait,
   futur_anterieur, passe_simple, passe_anterieur, subj_present, subj_passe,
   subj_imparfait, subj_plus_que_parfait, cond_present, cond_passe

2. "forms" có ĐÚNG 6 key: j, tu, il_elle, nous, vous, elles — không thêm không bớt.
   Giá trị KHÔNG chứa đại từ chủ ngữ (viết "parle", KHÔNG viết "je parle").
   Thì kép PHẢI gồm cả trợ động từ: "ai parlé", "suis allé", "vais parler".

3. Động từ đi với ÊTRE ở thì kép (aller, venir, partir, arriver, rester, monter,
   descendre, tomber, naître, mourir, retourner, passer...):
   - forms viết theo giống ĐỰC: "suis allé", "es allé", "est allé", "sommes allés", "êtes allés"
   - riêng "elles" luôn giống cái số nhiều: "sont allées"
   - thêm "alt" cho các dạng hợp giống khác, đặt NGANG HÀNG với "forms":
     "alt": { "j": ["suis allée"], "tu": ["es allée"], "il_elle": ["est allée"],
              "nous": ["sommes allées"], "vous": ["êtes allé", "êtes allée", "êtes allées"] }

4. Động từ PHẢN THÂN (se lever, s'appeler, se laver...):
   - "word" ghi dạng nguyên mẫu có "se": "se lever"
   - forms = đại từ phản thân + động từ chia, KHÔNG chứa chủ ngữ. Mẫu présent của se lever:
     { "j": "me lève", "tu": "te lèves", "il_elle": "se lève",
       "nous": "nous levons", "vous": "vous levez", "elles": "se lèvent" }
     (câu đầy đủ là "nous nous levons" — chủ ngữ "nous" nằm ở "before" của cloze,
     còn forms giữ lại đại từ phản thân "nous levons")
   - thì kép dùng ÊTRE + hợp giống: "me suis levé" (+ alt "me suis levée"),
     elles = "se sont levées"
   - thêm slug "phan-than" vào topics

5. "category": ĐÚNG 1 slug, tự xác định theo cách chia ở présent:
   - "nhom-er" — 1er groupe (parler, regarder, manger… kể cả từ có ngoại lệ chính tả)
   - "nhom-ir" — 2e groupe kiểu finir/-issons (finir, choisir, réussir…)
   - "nhom-3" — 3e groupe: mọi động từ còn lại (être, avoir, aller, prendre,
     vouloir, croire, dormir, sortir…)
   KHÔNG tự bịa slug khác. Các tính chất bổ sung (phản thân, khiếm khuyết, đi với
   être ở thì kép) KHÔNG phải category — thể hiện chúng trong "basics_vi" (nêu rõ)
   và trong forms/alt (chia đúng với être + hợp giống).

6. "cloze": mỗi thì ≥ 2 câu, dùng các đại từ KHÁC NHAU. Mỗi câu PHẢI có tín hiệu ngữ
   cảnh để người học tự suy ra thì (hier, demain, tous les jours, maintenant, l'année
   prochaine, quand j'étais petit, il faut que, si j'avais...). Câu mà 2 thì đều đúng
   là câu HỎNG. "before" chứa cả chủ ngữ (chú ý nối âm: "j'", "qu'il"); "answer" chỉ là
   phần động từ đã chia.

7. QUAN TRỌNG NHẤT: "answer" của cloze phải TRÙNG KHỚP TỪNG KÝ TỰ với một giá trị trong
   "forms" hoặc "alt" của đúng thì đó. Sau khi viết xong, TỰ RÀ LẠI từng cloze một.

8. "hint" luôn = nguyên mẫu của động từ (= "word"). "explain_vi" 1 câu tiếng Việt:
   tín hiệu nào → thì gì, chia thế nào.

9. Bảng chia phải chính xác tuyệt đối theo chuẩn (Bescherelle/Le Conjugueur), kể cả
   ngoại lệ chính tả (manger→mangeons, commencer→commençons, appeler→appelle,
   acheter→achète, préférer→préfère...).

10. Tiếng Việt tự nhiên, xưng hô trung tính (tôi/bạn/anh ấy/cô ấy/chúng tôi/họ).
    Câu ví dụ trình độ A1-B1, đời thường, không hàn lâm.
```

---

## Category hợp lệ (agent tự gắn theo ràng buộc 5)

| Slug | Tên | Nhận biết |
|---|---|---|
| `nhom-er` | Động từ nhóm 1 (-er) | nguyên mẫu -er, chia -e/-es/-e/-ons/-ez/-ent (trừ aller) |
| `nhom-ir` | Động từ nhóm 2 (-ir) | nguyên mẫu -ir kiểu finir: -is/-issons |
| `nhom-3` | Động từ nhóm 3 (bất quy tắc) | mọi động từ còn lại |

Category mới → thêm vào `seed/categories.mjs` + `npm run seed` TRƯỚC khi giao cho agent.

## Mẹo vận hành

- **Batch nhỏ**: giao 5-8 từ/lần. Batch to agent dễ ẩu ở các từ cuối và dễ đứt output giữa chừng.
- **Thì kép giao cùng thì nền**: muốn có `passe_compose` thì giao kèm `present` (trợ động từ chia ở présent) — agent ít sai hơn.
- **Vòng sửa lỗi**: `npm run validate` in lỗi theo format `[từ.thì.cloze[i]] ...` — dán nguyên văn cho agent, nó tự biết sửa chỗ nào.
- **Duyệt tay sau khi validate đạt** (máy không kiểm được): đối chiếu bảng chia động từ bất quy tắc với Le Conjugueur; đọc cloze xem tín hiệu có rõ không; tiếng Việt có tự nhiên không.
- Import: POST `content/<file>.json` → `/api/words/import` (header `x-api-key`).

---

## Chế độ ĐIỀN SKELETON (khi có nguồn Le Conjugueur)

Quy trình: tải RTF từng động từ tại leconjugueur.lefigaro.fr (nút xuất RTF) → gom vào một
thư mục → `npm run parse:rtf <thư-mục> -- -o content/skeleton.json` → giao skeleton + prompt
dưới đây cho AI → lưu kết quả → `npm run validate content/<file>.json` → duyệt tay → import.

Prompt (dán kèm nội dung file skeleton.json):

```text
Bạn là chuyên gia ngữ pháp tiếng Pháp kiêm giáo viên dạy người Việt. Dưới đây là mảng JSON
skeleton: bảng chia (forms/alt) đã được trích từ nguồn chuẩn Le Conjugueur và LUÔN ĐÚNG.

NHIỆM VỤ: chỉ điền các field đang rỗng, trả về TOÀN BỘ mảng JSON hoàn chỉnh (không markdown):
- meaning_vi, meaning_en, basics_vi (2-3 câu tiếng Việt: nhóm động từ, trợ động từ thì kép,
  ngoại lệ đáng nhớ)
- mỗi thì: rule_vi (quy tắc chia bằng tiếng Việt, 1-2 câu) + examples (1 câu Pháp + dịch Việt)
  + cloze (≥2 câu, đại từ khác nhau, PHẢI có tín hiệu ngữ cảnh: hier, demain, il faut que…)

CẤM TUYỆT ĐỐI:
- Sửa, thêm, bớt bất kỳ giá trị nào trong "word", "category", "forms", "alt"
- Bịa dạng chia mới: "answer" của cloze phải COPY NGUYÊN VĂN một giá trị có sẵn trong
  forms hoặc alt của đúng thì đó
- "hint" của cloze luôn = "word". "before" chứa chủ ngữ (chú ý nối âm j', qu'il).

[DÁN NỘI DUNG content/skeleton.json VÀO ĐÂY]
```
