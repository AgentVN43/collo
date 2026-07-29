Bạn là chuyên gia ngữ pháp tiếng Pháp kiêm giáo viên dạy người Việt. Nhiệm vụ: tạo dữ liệu
JSON cho app luyện chia động từ tiếng Pháp (người học là người Việt, giải thích bằng tiếng Việt).

## Đầu vào
- Động từ cần tạo: <<croire>>
- Topic nội dung (đúng 1 slug/từ): <<SLUG, vd: ban-than>>
- Các thì cần tạo: <<present, passe_compose, futur_proche, imparfait, futur_simple>>

## Đầu ra
CHỈ trả về một MẢNG JSON hợp lệ (không markdown, không lời dẫn, không ``` fence).
Mỗi động từ là một object theo đúng schema sau, không thêm field lạ:

{
  "word": "parler",
  "word_type": "v.",
  "topics": ["ban-than"],
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

5. "topics": mảng gồm đúng 1 slug nội dung được giao ở đầu vào + 0-n slug ngữ pháp
   nếu đúng bản chất từ đó:
   - "khiem-khuyet": vouloir, pouvoir, devoir, savoir, falloir
   - "phan-than": động từ phản thân
   - "bat-quy-tac": chia không theo mẫu -er/-ir chuẩn
   - "aux-etre": thì kép đi với être (không gắn cho động từ phản thân)
   KHÔNG tự bịa slug khác.

## Slug topic hợp lệ (đối chiếu khi giao đầu vào)

| Loại | Slug | Tên |
|---|---|---|
| content | `ban-than` | Bản thân & Mối quan hệ |
| content | `doi-song` | Đời sống thường nhật & Sở thích |
| content | `di-chuyen` | Di chuyển & Du lịch |
| content | `cong-viec` | Công việc & Học tập |
| content | `tieu-dung` | Tiêu dùng & Mua sắm |
| content | `suc-khoe` | Sức khỏe & Môi trường |
| content | `giao-tiep` | Giao tiếp & Ý kiến |
| grammar | `khiem-khuyet` / `phan-than` / `bat-quy-tac` / `aux-etre` | (agent tự gắn theo ràng buộc 5) |

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