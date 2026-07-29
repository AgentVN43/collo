// Seed content: 13 động từ tiếng Pháp × 15 thì.
// 3 thì lõi (présent, passé composé, futur proche) soạn tay đầy đủ ở mảng `words`;
// 12 thì mở rộng được sinh ở cuối file (bảng chia chính xác tuyệt đối vì thì ghép
// của tiếng Pháp cấu tạo quy tắc từ trợ động từ + participe passé).
// Chạy `npm run seed` để đẩy vào Supabase, hoặc POST mảng này tới /api/words/import.

const P = ["j", "tu", "il_elle", "nous", "vous", "elles"];
const f = (a) => Object.fromEntries(P.map((p, i) => [p, a[i]]));

const RULE_ER =
  "Động từ nhóm 1 (-er): bỏ đuôi -er, thêm -e, -es, -e, -ons, -ez, -ent.";
const RULE_PC_AVOIR =
  "Passé composé = avoir (chia ở présent) + participe passé. Diễn tả hành động đã xảy ra và kết thúc trong quá khứ.";
const RULE_PC_ETRE =
  "Passé composé = être (chia ở présent) + participe passé. Với trợ động từ être, participe passé phải hợp giống và số với chủ ngữ (thêm -e cho giống cái, -s cho số nhiều).";
const RULE_FP =
  "Futur proche = aller (chia ở présent) + động từ nguyên mẫu. Diễn tả việc sắp xảy ra hoặc dự định chắc chắn.";

const pcAvoir = (pp) =>
  f([`ai ${pp}`, `as ${pp}`, `a ${pp}`, `avons ${pp}`, `avez ${pp}`, `ont ${pp}`]);
const pcEtreForms = (pp) =>
  f([`suis ${pp}`, `es ${pp}`, `est ${pp}`, `sommes ${pp}s`, `êtes ${pp}s`, `sont ${pp}es`]);
const pcEtreAlt = (pp) => ({
  j: [`suis ${pp}e`],
  tu: [`es ${pp}e`],
  il_elle: [`est ${pp}e`],
  nous: [`sommes ${pp}es`],
  vous: [`êtes ${pp}`, `êtes ${pp}e`, `êtes ${pp}es`],
});
const fp = (inf) =>
  f([`vais ${inf}`, `vas ${inf}`, `va ${inf}`, `allons ${inf}`, `allez ${inf}`, `vont ${inf}`]);

export const words = [
  {
    word: "regarder",
    word_type: "v.",
    category: "nhom-er",
    meaning_vi: "xem, nhìn",
    meaning_en: "to watch, to look at",
    basics_vi:
      "Động từ nhóm 1 (-er), chia hoàn toàn theo quy tắc. Dùng khi xem tivi, xem phim, nhìn ai đó hoặc vật gì đó.",
    conjugations: {
      present: {
        rule_vi: RULE_ER,
        forms: f(["regarde", "regardes", "regarde", "regardons", "regardez", "regardent"]),
        examples: [{ fr: "Je regarde la télévision le soir.", vi: "Tôi xem tivi vào buổi tối." }],
        cloze: [
          { before: "Tous les soirs, je ", after: " la télé.", answer: "regarde", hint: "regarder", explain_vi: "\"Tous les soirs\" (mỗi tối) chỉ thói quen lặp lại → dùng présent. Je + -e: regarde." },
          { before: "Nous ", after: " un match de foot maintenant.", answer: "regardons", hint: "regarder", explain_vi: "\"Maintenant\" (bây giờ) → présent. Nous + -ons: regardons." },
        ],
      },
      passe_compose: {
        rule_vi: RULE_PC_AVOIR + " Participe passé của regarder: regardé.",
        forms: pcAvoir("regardé"),
        examples: [{ fr: "Hier, j'ai regardé un film français.", vi: "Hôm qua tôi đã xem một bộ phim Pháp." }],
        cloze: [
          { before: "Hier soir, elle ", after: " un bon film.", answer: "a regardé", hint: "regarder", explain_vi: "\"Hier soir\" (tối qua) → quá khứ → passé composé: elle a regardé." },
          { before: "Le week-end dernier, nous ", after: " de vieilles photos.", answer: "avons regardé", hint: "regarder", explain_vi: "\"Le week-end dernier\" (cuối tuần trước) → passé composé: nous avons regardé." },
        ],
      },
      futur_proche: {
        rule_vi: RULE_FP,
        forms: fp("regarder"),
        examples: [{ fr: "Ce soir, je vais regarder une série.", vi: "Tối nay tôi sẽ xem một bộ phim dài tập." }],
        cloze: [
          { before: "Ce soir, elles ", after: " une série coréenne.", answer: "vont regarder", hint: "regarder", explain_vi: "\"Ce soir\" (tối nay) → việc sắp xảy ra → futur proche: elles vont + regarder." },
          { before: "Demain, tu ", after: " le match avec moi ?", answer: "vas regarder", hint: "regarder", explain_vi: "\"Demain\" (ngày mai) → futur proche: tu vas + nguyên mẫu regarder." },
        ],
      },
    },
  },
  {
    word: "écouter",
    word_type: "v.",
    category: "nhom-er",
    meaning_vi: "nghe, lắng nghe",
    meaning_en: "to listen (to)",
    basics_vi:
      "Động từ nhóm 1 (-er), quy tắc. Bắt đầu bằng nguyên âm nên \"je\" rút gọn thành \"j'\": j'écoute.",
    conjugations: {
      present: {
        rule_vi: RULE_ER + " Lưu ý: je → j' trước nguyên âm (j'écoute).",
        forms: f(["écoute", "écoutes", "écoute", "écoutons", "écoutez", "écoutent"]),
        examples: [{ fr: "J'écoute de la musique dans le bus.", vi: "Tôi nghe nhạc trên xe buýt." }],
        cloze: [
          { before: "Chaque matin, j'", after: " la radio.", answer: "écoute", hint: "écouter", explain_vi: "\"Chaque matin\" (mỗi sáng) = thói quen → présent. J' + écoute." },
          { before: "Vous ", after: " le professeur en classe.", answer: "écoutez", hint: "écouter", explain_vi: "Câu nói về việc thường ngày → présent. Vous + -ez: écoutez." },
        ],
      },
      passe_compose: {
        rule_vi: RULE_PC_AVOIR + " Participe passé: écouté.",
        forms: pcAvoir("écouté"),
        examples: [{ fr: "Hier, nous avons écouté un podcast.", vi: "Hôm qua chúng tôi đã nghe một podcast." }],
        cloze: [
          { before: "Hier soir, il ", after: " ses messages vocaux.", answer: "a écouté", hint: "écouter", explain_vi: "\"Hier soir\" → passé composé: il a écouté." },
          { before: "La semaine dernière, elles ", after: " ce nouvel album.", answer: "ont écouté", hint: "écouter", explain_vi: "\"La semaine dernière\" (tuần trước) → passé composé: elles ont écouté." },
        ],
      },
      futur_proche: {
        rule_vi: RULE_FP,
        forms: fp("écouter"),
        examples: [{ fr: "Ce soir, je vais écouter un podcast.", vi: "Tối nay tôi sẽ nghe một podcast." }],
        cloze: [
          { before: "Après le dîner, nous ", after: " de la musique.", answer: "allons écouter", hint: "écouter", explain_vi: "\"Après le dîner\" (sau bữa tối) → việc sắp làm → futur proche: nous allons + écouter." },
          { before: "Demain, elle ", after: " la nouvelle chanson.", answer: "va écouter", hint: "écouter", explain_vi: "\"Demain\" → futur proche: elle va + écouter." },
        ],
      },
    },
  },
  {
    word: "manger",
    word_type: "v.",
    category: "nhom-er",
    meaning_vi: "ăn",
    meaning_en: "to eat",
    basics_vi:
      "Động từ nhóm 1 (-er) nhưng có ngoại lệ chính tả: với \"nous\" phải giữ chữ e → nous mangeons (không phải mangons) để giữ âm /ʒ/.",
    conjugations: {
      present: {
        rule_vi: RULE_ER + " Ngoại lệ: nous mangeons (thêm e để giữ âm \"giơ\").",
        forms: f(["mange", "manges", "mange", "mangeons", "mangez", "mangent"]),
        examples: [{ fr: "Nous mangeons ensemble à midi.", vi: "Chúng tôi ăn cùng nhau vào buổi trưa." }],
        cloze: [
          { before: "À midi, nous ", after: " à la cantine.", answer: "mangeons", hint: "manger", explain_vi: "Thói quen hằng ngày → présent. Ngoại lệ chính tả: mangeons (giữ e sau g)." },
          { before: "Tu ", after: " des fruits tous les jours.", answer: "manges", hint: "manger", explain_vi: "\"Tous les jours\" (mỗi ngày) → présent. Tu + -es: manges." },
        ],
      },
      passe_compose: {
        rule_vi: RULE_PC_AVOIR + " Participe passé: mangé.",
        forms: pcAvoir("mangé"),
        examples: [{ fr: "Hier, j'ai mangé une pizza.", vi: "Hôm qua tôi đã ăn pizza." }],
        cloze: [
          { before: "Hier soir, elles ", after: " au restaurant.", answer: "ont mangé", hint: "manger", explain_vi: "\"Hier soir\" → passé composé: elles ont mangé." },
          { before: "Ce matin, j'", after: " un croissant.", answer: "ai mangé", hint: "manger", explain_vi: "\"Ce matin\" (sáng nay — đã qua) → passé composé: j'ai mangé." },
        ],
      },
      futur_proche: {
        rule_vi: RULE_FP,
        forms: fp("manger"),
        examples: [{ fr: "Ce soir, nous allons manger chez mes parents.", vi: "Tối nay chúng tôi sẽ ăn ở nhà bố mẹ tôi." }],
        cloze: [
          { before: "Demain midi, vous ", after: " chez nous.", answer: "allez manger", hint: "manger", explain_vi: "\"Demain midi\" (trưa mai) → futur proche: vous allez + manger." },
          { before: "Ce soir, je ", after: " une soupe.", answer: "vais manger", hint: "manger", explain_vi: "\"Ce soir\" → futur proche: je vais + manger." },
        ],
      },
    },
  },
  {
    word: "lire",
    word_type: "v.",
    category: "nhom-3",
    meaning_vi: "đọc",
    meaning_en: "to read",
    basics_vi:
      "Động từ nhóm 3, bất quy tắc. Số ít: lis, lis, lit. Số nhiều có thêm -s-: lisons, lisez, lisent.",
    conjugations: {
      present: {
        rule_vi: "Bất quy tắc: je lis, tu lis, il lit / nous lisons, vous lisez, elles lisent (số nhiều thêm -s-).",
        forms: f(["lis", "lis", "lit", "lisons", "lisez", "lisent"]),
        examples: [{ fr: "Elle lit un roman français.", vi: "Cô ấy đang đọc một cuốn tiểu thuyết Pháp." }],
        cloze: [
          { before: "Le soir, je ", after: " un livre avant de dormir.", answer: "lis", hint: "lire", explain_vi: "Thói quen buổi tối → présent. Je lis." },
          { before: "Vous ", after: " le journal chaque matin.", answer: "lisez", hint: "lire", explain_vi: "\"Chaque matin\" → présent. Vous lisez (gốc lis- + ez)." },
        ],
      },
      passe_compose: {
        rule_vi: RULE_PC_AVOIR + " Participe passé bất quy tắc: lu.",
        forms: pcAvoir("lu"),
        examples: [{ fr: "J'ai lu ce livre deux fois.", vi: "Tôi đã đọc cuốn sách này hai lần." }],
        cloze: [
          { before: "Hier, elle ", after: " tout le chapitre.", answer: "a lu", hint: "lire", explain_vi: "\"Hier\" → passé composé. Participe passé bất quy tắc: lu → elle a lu." },
          { before: "L'année dernière, nous ", after: " trois romans.", answer: "avons lu", hint: "lire", explain_vi: "\"L'année dernière\" (năm ngoái) → passé composé: nous avons lu." },
        ],
      },
      futur_proche: {
        rule_vi: RULE_FP,
        forms: fp("lire"),
        examples: [{ fr: "Pendant les vacances, je vais lire ce roman.", vi: "Trong kỳ nghỉ, tôi sẽ đọc cuốn tiểu thuyết này." }],
        cloze: [
          { before: "Pendant les vacances, je ", after: " ce gros roman.", answer: "vais lire", hint: "lire", explain_vi: "Dự định cho kỳ nghỉ sắp tới → futur proche: je vais + lire." },
          { before: "Demain, elles ", after: " le nouveau chapitre.", answer: "vont lire", hint: "lire", explain_vi: "\"Demain\" → futur proche: elles vont + lire." },
        ],
      },
    },
  },
  {
    word: "dire",
    word_type: "v.",
    category: "nhom-3",
    meaning_vi: "nói, bảo",
    meaning_en: "to say, to tell",
    basics_vi:
      "Động từ nhóm 3, bất quy tắc. NGOẠI LỆ quan trọng: vous dites (không phải \"disez\") — cùng nhóm với vous êtes, vous faites.",
    conjugations: {
      present: {
        rule_vi: "Bất quy tắc: dis, dis, dit / disons, DITES, disent. Ngoại lệ: vous dites.",
        forms: f(["dis", "dis", "dit", "disons", "dites", "disent"]),
        examples: [{ fr: "Je dis bonjour à mes voisins.", vi: "Tôi chào những người hàng xóm của tôi." }],
        cloze: [
          { before: "Vous ", after: " toujours la vérité.", answer: "dites", hint: "dire", explain_vi: "Ngoại lệ phải thuộc lòng: vous DITES, không phải \"disez\"." },
          { before: "Elles ", after: " que le film est super.", answer: "disent", hint: "dire", explain_vi: "Présent, elles + disent (gốc dis- + ent)." },
        ],
      },
      passe_compose: {
        rule_vi: RULE_PC_AVOIR + " Participe passé bất quy tắc: dit.",
        forms: pcAvoir("dit"),
        examples: [{ fr: "Il a dit oui !", vi: "Anh ấy đã nói đồng ý!" }],
        cloze: [
          { before: "Hier, tu ", after: " quelque chose d'important.", answer: "as dit", hint: "dire", explain_vi: "\"Hier\" → passé composé: tu as dit." },
          { before: "Ce matin, elle ", after: " bonjour à tout le monde.", answer: "a dit", hint: "dire", explain_vi: "\"Ce matin\" (đã qua) → passé composé: elle a dit." },
        ],
      },
      futur_proche: {
        rule_vi: RULE_FP,
        forms: fp("dire"),
        examples: [{ fr: "Je vais dire la vérité à ma mère.", vi: "Tôi sẽ nói sự thật với mẹ tôi." }],
        cloze: [
          { before: "Demain, nous ", after: " la nouvelle à papa.", answer: "allons dire", hint: "dire", explain_vi: "\"Demain\" → futur proche: nous allons + dire." },
          { before: "Ce soir, je ", after: " ce que je pense.", answer: "vais dire", hint: "dire", explain_vi: "\"Ce soir\" → futur proche: je vais + dire." },
        ],
      },
    },
  },
  {
    word: "prendre",
    word_type: "v.",
    category: "nhom-3",
    meaning_vi: "lấy, cầm; dùng (đồ ăn/uống); bắt (xe, tàu)",
    meaning_en: "to take",
    basics_vi:
      "Động từ nhóm 3, bất quy tắc. Số ít giữ d: prends, prends, prend. Số nhiều bỏ d: prenons, prenez; riêng elles prennent nhân đôi n.",
    conjugations: {
      present: {
        rule_vi: "Bất quy tắc: prends, prends, prend / prenons, prenez, prennent (bỏ d ở số nhiều, nhân đôi n ở ngôi 3 số nhiều).",
        forms: f(["prends", "prends", "prend", "prenons", "prenez", "prennent"]),
        examples: [{ fr: "Je prends le bus pour aller au travail.", vi: "Tôi bắt xe buýt để đi làm." }],
        cloze: [
          { before: "Chaque matin, il ", after: " le métro.", answer: "prend", hint: "prendre", explain_vi: "\"Chaque matin\" → présent. Il prend (giữ d, không có s)." },
          { before: "Nous ", after: " un café ensemble ?", answer: "prenons", hint: "prendre", explain_vi: "Đề nghị ở hiện tại → présent. Nous prenons (bỏ d)." },
        ],
      },
      passe_compose: {
        rule_vi: RULE_PC_AVOIR + " Participe passé bất quy tắc: pris.",
        forms: pcAvoir("pris"),
        examples: [{ fr: "Elle a pris le train hier.", vi: "Cô ấy đã đi tàu hôm qua." }],
        cloze: [
          { before: "Hier, j'", after: " le train de 8 heures.", answer: "ai pris", hint: "prendre", explain_vi: "\"Hier\" → passé composé. Participe passé bất quy tắc: pris → j'ai pris." },
          { before: "La semaine dernière, vous ", after: " trop de café.", answer: "avez pris", hint: "prendre", explain_vi: "\"La semaine dernière\" → passé composé: vous avez pris." },
        ],
      },
      futur_proche: {
        rule_vi: RULE_FP,
        forms: fp("prendre"),
        examples: [{ fr: "Demain, je vais prendre un taxi.", vi: "Ngày mai tôi sẽ đi taxi." }],
        cloze: [
          { before: "Demain matin, elles ", after: " l'avion.", answer: "vont prendre", hint: "prendre", explain_vi: "\"Demain matin\" → futur proche: elles vont + prendre." },
          { before: "Ce soir, tu ", after: " une douche avant de dormir.", answer: "vas prendre", hint: "prendre", explain_vi: "\"Ce soir\" → futur proche: tu vas + prendre." },
        ],
      },
    },
  },
  {
    word: "vouloir",
    word_type: "v.",
    category: "nhom-3",
    meaning_vi: "muốn",
    meaning_en: "to want",
    basics_vi:
      "Động từ nhóm 3, bất quy tắc, thường đứng trước động từ nguyên mẫu (je veux manger = tôi muốn ăn). \"Je voudrais\" là dạng lịch sự khi gọi món.",
    conjugations: {
      present: {
        rule_vi: "Bất quy tắc: veux, veux, veut / voulons, voulez, veulent (đổi gốc veu-/voul-).",
        forms: f(["veux", "veux", "veut", "voulons", "voulez", "veulent"]),
        examples: [{ fr: "Je veux apprendre le français.", vi: "Tôi muốn học tiếng Pháp." }],
        cloze: [
          { before: "Elle ", after: " un café, s'il vous plaît.", answer: "veut", hint: "vouloir", explain_vi: "Présent, ngôi il/elle: veut (gốc veu- + t)." },
          { before: "Nous ", after: " visiter Paris cet été.", answer: "voulons", hint: "vouloir", explain_vi: "Ngôi nous đổi gốc thành voul-: nous voulons." },
        ],
      },
      passe_compose: {
        rule_vi: RULE_PC_AVOIR + " Participe passé bất quy tắc: voulu.",
        forms: pcAvoir("voulu"),
        examples: [{ fr: "Il a voulu partir tôt.", vi: "Anh ấy đã muốn về sớm." }],
        cloze: [
          { before: "Hier, elles ", after: " rester à la maison.", answer: "ont voulu", hint: "vouloir", explain_vi: "\"Hier\" → passé composé: elles ont voulu." },
          { before: "Ce matin, tu ", after: " dormir plus longtemps.", answer: "as voulu", hint: "vouloir", explain_vi: "\"Ce matin\" (đã qua) → passé composé: tu as voulu." },
        ],
      },
      futur_proche: {
        rule_vi: RULE_FP,
        forms: fp("vouloir"),
        examples: [{ fr: "Après ce film, tu vas vouloir voir la suite.", vi: "Sau bộ phim này, bạn sẽ muốn xem phần tiếp theo." }],
        cloze: [
          { before: "Après ce film, tu ", after: " voir la suite.", answer: "vas vouloir", hint: "vouloir", explain_vi: "Việc sắp xảy ra → futur proche: tu vas + vouloir." },
          { before: "Elle ", after: " goûter ce gâteau, c'est sûr !", answer: "va vouloir", hint: "vouloir", explain_vi: "Dự đoán chắc chắn về điều sắp tới → futur proche: elle va + vouloir." },
        ],
      },
    },
  },
  {
    word: "pouvoir",
    word_type: "v.",
    category: "nhom-3",
    meaning_vi: "có thể",
    meaning_en: "can, to be able to",
    basics_vi:
      "Động từ nhóm 3, bất quy tắc, luôn đi với động từ nguyên mẫu (je peux venir = tôi có thể đến). Chia gần giống vouloir.",
    conjugations: {
      present: {
        rule_vi: "Bất quy tắc: peux, peux, peut / pouvons, pouvez, peuvent (đổi gốc peu-/pouv-).",
        forms: f(["peux", "peux", "peut", "pouvons", "pouvez", "peuvent"]),
        examples: [{ fr: "Je peux vous aider ?", vi: "Tôi có thể giúp gì cho bạn?" }],
        cloze: [
          { before: "Tu ", after: " répéter, s'il te plaît ?", answer: "peux", hint: "pouvoir", explain_vi: "Présent, ngôi tu: peux (đuôi -x, không phải -s)." },
          { before: "Vous ", after: " parler plus lentement ?", answer: "pouvez", hint: "pouvoir", explain_vi: "Ngôi vous đổi gốc thành pouv-: vous pouvez." },
        ],
      },
      passe_compose: {
        rule_vi: RULE_PC_AVOIR + " Participe passé bất quy tắc: pu.",
        forms: pcAvoir("pu"),
        examples: [{ fr: "Elle n'a pas pu venir hier.", vi: "Hôm qua cô ấy đã không thể đến." }],
        cloze: [
          { before: "Hier, il ", after: " finir tout le travail.", answer: "a pu", hint: "pouvoir", explain_vi: "\"Hier\" → passé composé. Participe passé: pu → il a pu." },
          { before: "Finalement, nous ", after: " trouver un taxi.", answer: "avons pu", hint: "pouvoir", explain_vi: "\"Finalement\" kể lại kết quả đã xảy ra → passé composé: nous avons pu." },
        ],
      },
      futur_proche: {
        rule_vi: RULE_FP,
        forms: fp("pouvoir"),
        examples: [{ fr: "Demain, je vais pouvoir t'aider.", vi: "Ngày mai tôi sẽ có thể giúp bạn." }],
        cloze: [
          { before: "Demain, je ", after: " t'aider.", answer: "vais pouvoir", hint: "pouvoir", explain_vi: "\"Demain\" → futur proche: je vais + pouvoir." },
          { before: "Après le cours, elles ", after: " répondre à cette question.", answer: "vont pouvoir", hint: "pouvoir", explain_vi: "\"Après le cours\" (sau buổi học) → futur proche: elles vont + pouvoir." },
        ],
      },
    },
  },
  {
    word: "voir",
    word_type: "v.",
    category: "nhom-3",
    meaning_vi: "thấy, nhìn thấy; gặp",
    meaning_en: "to see",
    basics_vi:
      "Động từ nhóm 3, bất quy tắc. Chú ý nous voyons, vous voyez (i đổi thành y trước -ons/-ez).",
    conjugations: {
      present: {
        rule_vi: "Bất quy tắc: vois, vois, voit / voyons, voyez, voient (i → y ở nous, vous).",
        forms: f(["vois", "vois", "voit", "voyons", "voyez", "voient"]),
        examples: [{ fr: "Je vois la tour Eiffel de ma fenêtre.", vi: "Tôi nhìn thấy tháp Eiffel từ cửa sổ nhà tôi." }],
        cloze: [
          { before: "Tu ", after: " ce chien là-bas ?", answer: "vois", hint: "voir", explain_vi: "Présent, ngôi tu: vois." },
          { before: "Nous ", after: " nos amis chaque week-end.", answer: "voyons", hint: "voir", explain_vi: "\"Chaque week-end\" → présent. Chú ý i → y: nous voyons." },
        ],
      },
      passe_compose: {
        rule_vi: RULE_PC_AVOIR + " Participe passé bất quy tắc: vu.",
        forms: pcAvoir("vu"),
        examples: [{ fr: "J'ai vu un bon film hier.", vi: "Hôm qua tôi đã xem một bộ phim hay." }],
        cloze: [
          { before: "Hier soir, elles ", after: " un film au cinéma.", answer: "ont vu", hint: "voir", explain_vi: "\"Hier soir\" → passé composé: elles ont vu." },
          { before: "Ce matin, j'", after: " ton message.", answer: "ai vu", hint: "voir", explain_vi: "\"Ce matin\" (đã qua) → passé composé: j'ai vu." },
        ],
      },
      futur_proche: {
        rule_vi: RULE_FP,
        forms: fp("voir"),
        examples: [{ fr: "Ce week-end, je vais voir mes grands-parents.", vi: "Cuối tuần này tôi sẽ đi thăm ông bà." }],
        cloze: [
          { before: "Ce week-end, je ", after: " mes grands-parents.", answer: "vais voir", hint: "voir", explain_vi: "\"Ce week-end\" (sắp tới) → futur proche: je vais + voir." },
          { before: "Vous ", after: " la mer pour la première fois !", answer: "allez voir", hint: "voir", explain_vi: "Việc sắp xảy ra → futur proche: vous allez + voir." },
        ],
      },
    },
  },
  {
    word: "aller",
    word_type: "v.",
    category: "nhom-3",
    meaning_vi: "đi",
    meaning_en: "to go",
    basics_vi:
      "Động từ bất quy tắc hoàn toàn, cực kỳ quan trọng: vừa nghĩa là \"đi\", vừa dùng để tạo futur proche (aller + nguyên mẫu). Ở passé composé dùng trợ động từ ÊTRE, phân từ hợp giống & số.",
    conjugations: {
      present: {
        rule_vi: "Bất quy tắc hoàn toàn, phải thuộc lòng: vais, vas, va, allons, allez, vont.",
        forms: f(["vais", "vas", "va", "allons", "allez", "vont"]),
        examples: [{ fr: "Je vais à l'école à pied.", vi: "Tôi đi bộ đến trường." }],
        cloze: [
          { before: "Comment ça ", after: " ?", answer: "va", hint: "aller", explain_vi: "Câu chào hỏi kinh điển: Comment ça va ? — \"ça\" chia như il/elle: va." },
          { before: "Le samedi, nous ", after: " au marché.", answer: "allons", hint: "aller", explain_vi: "\"Le samedi\" (thứ Bảy hằng tuần) = thói quen → présent: nous allons." },
        ],
      },
      passe_compose: {
        rule_vi: RULE_PC_ETRE + " Participe passé: allé. Ví dụ: elle est allée, elles sont allées.",
        forms: pcEtreForms("allé"),
        alt: pcEtreAlt("allé"),
        examples: [{ fr: "Hier, nous sommes allés au cinéma.", vi: "Hôm qua chúng tôi đã đi xem phim." }],
        cloze: [
          { before: "Hier soir, nous ", after: " au cinéma.", answer: "sommes allés", alt: ["sommes allées"], hint: "aller", explain_vi: "\"Hier soir\" → passé composé với ÊTRE: nous sommes allés (thêm -s vì số nhiều; -es nếu toàn nữ)." },
          { before: "La semaine dernière, elle ", after: " à Paris.", answer: "est allée", hint: "aller", explain_vi: "Trợ động từ être → phân từ hợp giống với \"elle\": est allée (thêm -e)." },
        ],
      },
      futur_proche: {
        rule_vi: RULE_FP + " Với chính aller: je vais aller (hoàn toàn đúng ngữ pháp).",
        forms: fp("aller"),
        examples: [{ fr: "Demain, je vais aller chez le médecin.", vi: "Ngày mai tôi sẽ đi khám bác sĩ." }],
        cloze: [
          { before: "Demain, tu ", after: " à la piscine.", answer: "vas aller", hint: "aller", explain_vi: "\"Demain\" → futur proche: tu vas + aller." },
          { before: "Cet été, elles ", after: " en France.", answer: "vont aller", hint: "aller", explain_vi: "\"Cet été\" (hè này — sắp tới) → futur proche: elles vont + aller." },
        ],
      },
    },
  },
  {
    word: "venir",
    word_type: "v.",
    category: "nhom-3",
    meaning_vi: "đến, tới",
    meaning_en: "to come",
    basics_vi:
      "Động từ nhóm 3, bất quy tắc: viens, viens, vient / venons, venez, viennent. Ở passé composé dùng trợ động từ ÊTRE, phân từ hợp giống & số. \"Venir de + nguyên mẫu\" = vừa mới làm gì.",
    conjugations: {
      present: {
        rule_vi: "Bất quy tắc: viens, viens, vient / venons, venez, viennent (gốc vien-/ven-, nhân đôi n ở ngôi 3 số nhiều).",
        forms: f(["viens", "viens", "vient", "venons", "venez", "viennent"]),
        examples: [{ fr: "Il vient de Hanoï.", vi: "Anh ấy đến từ Hà Nội." }],
        cloze: [
          { before: "Tu ", after: " avec nous ce soir ?", answer: "viens", hint: "venir", explain_vi: "Lời mời ở hiện tại → présent: tu viens." },
          { before: "Elles ", after: " souvent chez moi.", answer: "viennent", hint: "venir", explain_vi: "\"Souvent\" (thường xuyên) → présent. Elles viennent (nhân đôi n)." },
        ],
      },
      passe_compose: {
        rule_vi: RULE_PC_ETRE + " Participe passé: venu. Ví dụ: elle est venue, elles sont venues.",
        forms: pcEtreForms("venu"),
        alt: pcEtreAlt("venu"),
        examples: [{ fr: "Elle est venue à la fête hier.", vi: "Hôm qua cô ấy đã đến bữa tiệc." }],
        cloze: [
          { before: "Hier, il ", after: " en retard.", answer: "est venu", hint: "venir", explain_vi: "\"Hier\" → passé composé với ÊTRE: il est venu." },
          { before: "Le week-end dernier, elles ", after: " nous voir.", answer: "sont venues", hint: "venir", explain_vi: "Trợ động từ être → hợp giống & số với \"elles\": sont venues (thêm -es)." },
        ],
      },
      futur_proche: {
        rule_vi: RULE_FP,
        forms: fp("venir"),
        examples: [{ fr: "Demain, je vais venir te chercher à la gare.", vi: "Ngày mai tôi sẽ đến đón bạn ở nhà ga." }],
        cloze: [
          { before: "Demain, je ", after: " te chercher à la gare.", answer: "vais venir", hint: "venir", explain_vi: "\"Demain\" → futur proche: je vais + venir." },
          { before: "Ce soir, vous ", after: " dîner chez nous ?", answer: "allez venir", hint: "venir", explain_vi: "\"Ce soir\" → futur proche: vous allez + venir." },
        ],
      },
    },
  },
  {
    word: "être",
    word_type: "v.",
    category: "nhom-3",
    meaning_vi: "thì, là, ở",
    meaning_en: "to be",
    basics_vi:
      "Động từ quan trọng nhất tiếng Pháp, bất quy tắc hoàn toàn. Vừa là động từ chính, vừa là trợ động từ ở passé composé cho nhóm động từ di chuyển (aller, venir...). Passé composé của chính être lại dùng AVOIR: j'ai été.",
    conjugations: {
      present: {
        rule_vi: "Bất quy tắc hoàn toàn, phải thuộc lòng: suis, es, est, sommes, êtes, sont.",
        forms: f(["suis", "es", "est", "sommes", "êtes", "sont"]),
        examples: [{ fr: "Je suis étudiant.", vi: "Tôi là sinh viên." }],
        cloze: [
          { before: "Nous ", after: " très contents.", answer: "sommes", hint: "être", explain_vi: "Présent: nous sommes." },
          { before: "Vous ", after: " français ?", answer: "êtes", hint: "être", explain_vi: "Présent: vous êtes (có dấu mũ ê)." },
        ],
      },
      passe_compose: {
        rule_vi: "Đặc biệt: passé composé của être dùng trợ động từ AVOIR + participe passé \"été\": j'ai été, tu as été...",
        forms: pcAvoir("été"),
        examples: [{ fr: "Le voyage a été super.", vi: "Chuyến đi đã rất tuyệt." }],
        cloze: [
          { before: "Hier, le cours ", after: " difficile.", answer: "a été", hint: "être", explain_vi: "\"Hier\" → passé composé. Être dùng trợ động từ avoir: a été." },
          { before: "Les vacances ", after: " magnifiques !", answer: "ont été", hint: "être", explain_vi: "\"Les vacances\" (số nhiều, chuyện đã qua) → ont été." },
        ],
      },
      futur_proche: {
        rule_vi: RULE_FP,
        forms: fp("être"),
        examples: [{ fr: "Demain, je vais être en retard.", vi: "Ngày mai tôi sẽ bị muộn." }],
        cloze: [
          { before: "Demain, je ", after: " en retard, désolé.", answer: "vais être", hint: "être", explain_vi: "\"Demain\" → futur proche: je vais + être." },
          { before: "Elle ", after: " contente de te voir.", answer: "va être", hint: "être", explain_vi: "Dự đoán điều sắp xảy ra → futur proche: elle va + être." },
        ],
      },
    },
  },
  {
    word: "avoir",
    word_type: "v.",
    category: "nhom-3",
    meaning_vi: "có",
    meaning_en: "to have",
    basics_vi:
      "Động từ nền tảng thứ hai, bất quy tắc hoàn toàn. Là trợ động từ của đa số động từ ở passé composé. Dùng trong nhiều cụm cố định: avoir faim (đói), avoir soif (khát), avoir 20 ans (20 tuổi).",
    conjugations: {
      present: {
        rule_vi: "Bất quy tắc hoàn toàn, phải thuộc lòng: ai, as, a, avons, avez, ont. Je → j': j'ai.",
        forms: f(["ai", "as", "a", "avons", "avez", "ont"]),
        examples: [{ fr: "J'ai deux sœurs.", vi: "Tôi có hai chị/em gái." }],
        cloze: [
          { before: "Tu ", after: " quel âge ?", answer: "as", hint: "avoir", explain_vi: "Hỏi tuổi dùng avoir: Tu as quel âge ?" },
          { before: "Elles ", after: " un chat et un chien.", answer: "ont", hint: "avoir", explain_vi: "Présent: elles ont." },
        ],
      },
      passe_compose: {
        rule_vi: RULE_PC_AVOIR + " Participe passé bất quy tắc: eu (đọc là /y/): j'ai eu.",
        forms: pcAvoir("eu"),
        examples: [{ fr: "J'ai eu de la chance !", vi: "Tôi đã gặp may!" }],
        cloze: [
          { before: "Hier, il ", after: " un petit accident.", answer: "a eu", hint: "avoir", explain_vi: "\"Hier\" → passé composé. Participe passé của avoir: eu → a eu." },
          { before: "La semaine dernière, nous ", after: " beaucoup de travail.", answer: "avons eu", hint: "avoir", explain_vi: "\"La semaine dernière\" → passé composé: nous avons eu." },
        ],
      },
      futur_proche: {
        rule_vi: RULE_FP,
        forms: fp("avoir"),
        examples: [{ fr: "Demain, tu vas avoir une bonne surprise.", vi: "Ngày mai bạn sẽ có một bất ngờ thú vị." }],
        cloze: [
          { before: "Demain, tu ", after: " une bonne surprise.", answer: "vas avoir", hint: "avoir", explain_vi: "\"Demain\" → futur proche: tu vas + avoir." },
          { before: "Après le sport, elles ", after: " faim.", answer: "vont avoir", hint: "avoir", explain_vi: "\"Après le sport\" → futur proche: elles vont + avoir (avoir faim = đói)." },
        ],
      },
    },
  },
];

// ====================================================================
// 12 THÌ MỞ RỘNG — sinh tự động, format đồng nhất với 3 thì lõi
// ====================================================================

// --- Trợ động từ ở các thì đơn (dùng để ghép thì kép) ---
const AVOIR_AUX = {
  impf: ["avais", "avais", "avait", "avions", "aviez", "avaient"],
  fut: ["aurai", "auras", "aura", "aurons", "aurez", "auront"],
  ps: ["eus", "eus", "eut", "eûmes", "eûtes", "eurent"],
  subj: ["aie", "aies", "ait", "ayons", "ayez", "aient"],
  subjImpf: ["eusse", "eusses", "eût", "eussions", "eussiez", "eussent"],
  cond: ["aurais", "aurais", "aurait", "aurions", "auriez", "auraient"],
};
const ETRE_AUX = {
  impf: ["étais", "étais", "était", "étions", "étiez", "étaient"],
  fut: ["serai", "seras", "sera", "serons", "serez", "seront"],
  ps: ["fus", "fus", "fut", "fûmes", "fûtes", "furent"],
  subj: ["sois", "sois", "soit", "soyons", "soyez", "soient"],
  subjImpf: ["fusse", "fusses", "fût", "fussions", "fussiez", "fussent"],
  cond: ["serais", "serais", "serait", "serions", "seriez", "seraient"],
};

// --- Helpers chia thì đơn (A = gốc ngôi ít/ils, B = gốc nous/vous nếu khác) ---
const impf = (A, B = A) => f([`${A}ais`, `${A}ais`, `${A}ait`, `${B}ions`, `${B}iez`, `${A}aient`]);
const futS = (stem) => f([`${stem}ai`, `${stem}as`, `${stem}a`, `${stem}ons`, `${stem}ez`, `${stem}ont`]);
const condP = (stem) => f([`${stem}ais`, `${stem}ais`, `${stem}ait`, `${stem}ions`, `${stem}iez`, `${stem}aient`]);
const psER = (A, B = A) => f([`${A}ai`, `${A}as`, `${A}a`, `${A}âmes`, `${A}âtes`, `${B}èrent`]);
const psI = (s) => f([`${s}is`, `${s}is`, `${s}it`, `${s}îmes`, `${s}îtes`, `${s}irent`]);
const psU = (s) => f([`${s}us`, `${s}us`, `${s}ut`, `${s}ûmes`, `${s}ûtes`, `${s}urent`]);
const subjP = (A, B = A) => f([`${A}e`, `${A}es`, `${A}e`, `${B}ions`, `${B}iez`, `${A}ent`]);
const sImpfA = (s) => f([`${s}asse`, `${s}asses`, `${s}ât`, `${s}assions`, `${s}assiez`, `${s}assent`]);
const sImpfI = (s) => f([`${s}isse`, `${s}isses`, `${s}ît`, `${s}issions`, `${s}issiez`, `${s}issent`]);
const sImpfU = (s) => f([`${s}usse`, `${s}usses`, `${s}ût`, `${s}ussions`, `${s}ussiez`, `${s}ussent`]);

// --- Helpers ghép thì kép (aux + participe passé; être thì hợp giống & số) ---
const compA = (aux, pp) => ({ forms: f(aux.map((a) => `${a} ${pp}`)) });
const compE = (aux, pp) => ({
  forms: f([`${aux[0]} ${pp}`, `${aux[1]} ${pp}`, `${aux[2]} ${pp}`, `${aux[3]} ${pp}s`, `${aux[4]} ${pp}s`, `${aux[5]} ${pp}es`]),
  alt: {
    j: [`${aux[0]} ${pp}e`],
    tu: [`${aux[1]} ${pp}e`],
    il_elle: [`${aux[2]} ${pp}e`],
    nous: [`${aux[3]} ${pp}es`],
    vous: [`${aux[4]} ${pp}`, `${aux[4]} ${pp}e`, `${aux[4]} ${pp}es`],
  },
});

// --- Khung câu ví dụ/cloze cho từng thì (có tín hiệu ngữ cảnh đặc trưng) ---
const PRON_VI = { j: "tôi", tu: "bạn", il_elle: "anh ấy", nous: "chúng tôi", vous: "các bạn", elles: "họ" };
const VOWELS_FR = "aeiouhéèêàâîïôûy";
function pronText(p, form) {
  if (p === "j") return VOWELS_FR.includes(form[0].toLowerCase()) ? "j'" : "je ";
  return { tu: "tu", il_elle: "il", nous: "nous", vous: "vous", elles: "elles" }[p] + " ";
}
const elide = (s) => s.replace("que il", "qu'il").replace("que elles", "qu'elles");

const EXT_FRAMES = {
  imparfait: {
    rule: (c) => `Imparfait = gốc của "nous" ở présent + -ais, -ais, -ait, -ions, -iez, -aient. Diễn tả thói quen hoặc khung cảnh trong quá khứ. Gốc: ${c.impfNote}.`,
    before: "Avant, {P}", after: " {C} tous les jours.",
    prons: ["j", "nous"],
    signal: '"Avant… tous les jours" = thói quen trong quá khứ → imparfait.',
    vi: (p, a) => `Hồi trước, ${p} thường ${a} mỗi ngày.`,
  },
  futur_simple: {
    rule: (c) => `Futur simple = gốc tương lai + -ai, -as, -a, -ons, -ez, -ont. Diễn tả tương lai xa/kế hoạch chắc chắn. Gốc của ${c.word}: ${c.fut}-.`,
    before: "L'année prochaine, {P}", after: " {C}.",
    prons: ["tu", "elles"],
    signal: '"L\'année prochaine" (năm sau) → tương lai xa → futur simple.',
    vi: (p, a) => `Năm sau, ${p} sẽ ${a}.`,
  },
  plus_que_parfait: {
    rule: (c) => `Plus-que-parfait = ${c.auxName} chia ở imparfait + participe passé (${c.pp}). Diễn tả "quá khứ của quá khứ" — việc xảy ra trước một mốc quá khứ khác.`,
    before: "Quand je suis arrivé, {P}", after: " {C}.",
    prons: ["il_elle", "elles"],
    signal: "Hành động xảy ra TRƯỚC mốc quá khứ \"quand je suis arrivé\" → plus-que-parfait.",
    vi: (p, a) => `Khi tôi đến nơi, ${p} đã ${a} từ trước.`,
  },
  futur_anterieur: {
    rule: (c) => `Futur antérieur = ${c.auxName} chia ở futur simple + participe passé (${c.pp}). Việc sẽ hoàn tất trước một mốc trong tương lai.`,
    before: "Avant ce soir, {P}", after: " {C}.",
    prons: ["nous", "tu"],
    signal: 'Việc hoàn tất trước mốc "avant ce soir" (trước tối nay) → futur antérieur.',
    vi: (p, a) => `Trước tối nay, ${p} sẽ ${a} xong.`,
  },
  passe_simple: {
    rule: () => "Passé simple là thì quá khứ của VĂN VIẾT (tiểu thuyết, báo chí, sử). Khi nói dùng passé composé thay thế.",
    before: "Ce jour-là, {P}", after: " {C}.",
    prons: ["il_elle", "elles"],
    signal: 'Trần thuật văn viết "ce jour-là" (ngày hôm ấy) → passé simple.',
    vi: (p, a) => `Hôm ấy, ${p} đã ${a}. (văn viết)`,
  },
  passe_anterieur: {
    rule: (c) => `Passé antérieur = ${c.auxName} chia ở passé simple + participe passé (${c.pp}). Văn viết, thường sau "dès que / quand" để chỉ việc vừa xong trước một việc khác.`,
    before: "Dès que {P}", after: " {C}, il partit.",
    prons: ["il_elle"],
    signal: 'Sau "dès que" trong văn trần thuật → passé antérieur.',
    vi: (p, a) => `Ngay khi ${p} vừa ${a} xong, anh ấy rời đi. (văn viết)`,
  },
  subj_present: {
    rule: (c) => `Subjonctif présent dùng sau il faut que, vouloir que, pour que… Đuôi: -e, -es, -e, -ions, -iez, -ent. ${c.subjNote}`,
    before: "Il faut que {P}", after: " {C}.",
    prons: ["tu", "vous"],
    signal: '"Il faut que" (cần phải) bắt buộc dùng subjonctif.',
    vi: (p, a) => `Cần là ${p} phải ${a}.`,
  },
  subj_passe: {
    rule: (c) => `Subjonctif passé = ${c.auxName} chia ở subjonctif présent + participe passé (${c.pp}). Dùng khi mệnh đề que nói về việc ĐÃ xảy ra.`,
    before: "Je suis content que {P}", after: " {C}.",
    prons: ["vous", "tu"],
    signal: 'Cảm xúc về việc đã xảy ra sau "que" → subjonctif passé.',
    vi: (p, a) => `Tôi mừng vì ${p} đã ${a}.`,
  },
  subj_imparfait: {
    rule: () => "Subjonctif imparfait là thì VĂN CHƯƠNG cổ điển, gần như chỉ gặp khi đọc văn học. Khi nói dùng subjonctif présent thay thế.",
    before: "Il fallait que {P}", after: " {C}.",
    prons: ["il_elle"],
    signal: 'Văn viết cổ điển: sau "il fallait que" → subjonctif imparfait.',
    vi: (p, a) => `(Văn chương) Lúc đó cần là ${p} phải ${a}.`,
  },
  subj_plus_que_parfait: {
    rule: (c) => `Subjonctif plus-que-parfait (văn chương) = ${c.auxName} chia ở subjonctif imparfait + participe passé (${c.pp}).`,
    before: "Il regrettait que {P}", after: " {C}.",
    prons: ["nous"],
    signal: "Văn chương: tiếc nuối việc đã xảy ra trước đó → subjonctif plus-que-parfait.",
    vi: (p, a) => `(Văn chương) Ông ấy tiếc rằng ${p} đã ${a}.`,
  },
  cond_present: {
    rule: (c) => `Conditionnel présent = gốc futur + đuôi imparfait (-ais, -ais, -ait, -ions, -iez, -aient). Diễn tả giả định hoặc lịch sự. Gốc của ${c.word}: ${c.fut}-.`,
    before: "Avec plus de temps, {P}", after: " {C}.",
    prons: ["j", "tu"],
    signal: 'Giả định "avec plus de temps" (nếu có thêm thời gian) → conditionnel présent.',
    vi: (p, a) => `Nếu có thêm thời gian, ${p} sẽ ${a}.`,
  },
  cond_passe: {
    rule: (c) => `Conditionnel passé = ${c.auxName} chia ở conditionnel présent + participe passé (${c.pp}). Giả định trong quá khứ — việc đã có thể xảy ra nhưng không.`,
    before: "Sans ce problème, {P}", after: " {C}.",
    prons: ["elles", "vous"],
    signal: "Giả định về quá khứ (đã có thể nhưng không xảy ra) → conditionnel passé.",
    vi: (p, a) => `Nếu không có trục trặc đó, ${p} đã ${a} rồi.`,
  },
};

// --- Cấu hình riêng từng động từ cho 12 thì mở rộng ---
// comp = bổ ngữ tiếng Pháp dùng trong câu mẫu; act = cụm nghĩa tiếng Việt tương ứng
const EXT = {
  regarder: { aux: "avoir", pp: "regardé", impf: ["regard"], fut: "regarder", ps: psER("regard"), subj: subjP("regard"), subjImpf: sImpfA("regard"), impfNote: "regard-", subjNote: "Gốc: regard-.", comp: "la télé", act: "xem tivi" },
  écouter: { aux: "avoir", pp: "écouté", impf: ["écout"], fut: "écouter", ps: psER("écout"), subj: subjP("écout"), subjImpf: sImpfA("écout"), impfNote: "écout-", subjNote: "Gốc: écout-.", comp: "la radio", act: "nghe radio" },
  manger: { aux: "avoir", pp: "mangé", impf: ["mange", "mang"], fut: "manger", ps: psER("mange", "mang"), subj: subjP("mang"), subjImpf: sImpfA("mange"), impfNote: "mange-/mang- (giữ e trước a để giữ âm \"giơ\")", subjNote: "Gốc: mang-.", comp: "une pomme", act: "ăn một quả táo" },
  lire: { aux: "avoir", pp: "lu", impf: ["lis"], fut: "lir", ps: psU("l"), subj: subjP("lis"), subjImpf: sImpfU("l"), impfNote: "lis-", subjNote: "Gốc: lis-.", comp: "ce livre", act: "đọc cuốn sách này" },
  dire: { aux: "avoir", pp: "dit", impf: ["dis"], fut: "dir", ps: psI("d"), subj: subjP("dis"), subjImpf: sImpfI("d"), impfNote: "dis-", subjNote: "Gốc: dis-.", comp: "la vérité", act: "nói sự thật" },
  prendre: { aux: "avoir", pp: "pris", impf: ["pren"], fut: "prendr", ps: psI("pr"), subj: subjP("prenn", "pren"), subjImpf: sImpfI("pr"), impfNote: "pren-", subjNote: "Gốc: prenn-/pren- (nhân đôi n ở ngôi ít và ils).", comp: "le bus", act: "bắt xe buýt" },
  vouloir: { aux: "avoir", pp: "voulu", impf: ["voul"], fut: "voudr", ps: psU("voul"), subj: subjP("veuill", "voul"), subjImpf: sImpfU("voul"), impfNote: "voul-", subjNote: "Bất quy tắc: veuille/veuilles/veuille, voulions/vouliez, veuillent.", comp: "partir", act: "muốn rời đi" },
  pouvoir: { aux: "avoir", pp: "pu", impf: ["pouv"], fut: "pourr", ps: psU("p"), subj: subjP("puiss"), subjImpf: sImpfU("p"), impfNote: "pouv-", subjNote: "Bất quy tắc: gốc puiss- ở mọi ngôi.", comp: "venir", act: "có thể đến" },
  voir: { aux: "avoir", pp: "vu", impf: ["voy"], fut: "verr", ps: psI("v"), subj: subjP("voi", "voy"), subjImpf: sImpfI("v"), impfNote: "voy-", subjNote: "Gốc: voi-/voy-.", comp: "ce film", act: "xem bộ phim này" },
  aller: { aux: "etre", pp: "allé", impf: ["all"], fut: "ir", ps: psER("all"), subj: subjP("aill", "all"), subjImpf: sImpfA("all"), impfNote: "all-", subjNote: "Bất quy tắc: aille/ailles/aille, allions/alliez, aillent.", comp: "au marché", act: "đi chợ" },
  venir: { aux: "etre", pp: "venu", impf: ["ven"], fut: "viendr", ps: f(["vins", "vins", "vint", "vînmes", "vîntes", "vinrent"]), subj: subjP("vienn", "ven"), subjImpf: f(["vinsse", "vinsses", "vînt", "vinssions", "vinssiez", "vinssent"]), impfNote: "ven-", subjNote: "Gốc: vienn-/ven-.", comp: "chez moi", act: "đến nhà tôi" },
  être: { aux: "avoir", pp: "été", impf: ["ét"], fut: "ser", ps: psU("f"), subj: f(["sois", "sois", "soit", "soyons", "soyez", "soient"]), subjImpf: sImpfU("f"), impfNote: "ét-", subjNote: "Bất quy tắc hoàn toàn: sois, sois, soit, soyons, soyez, soient.", comp: "à l'heure", act: "đúng giờ" },
  avoir: { aux: "avoir", pp: "eu", impf: ["av"], fut: "aur", ps: psU("e"), subj: f(["aie", "aies", "ait", "ayons", "ayez", "aient"]), subjImpf: sImpfU("e"), impfNote: "av-", subjNote: "Bất quy tắc hoàn toàn: aie, aies, ait, ayons, ayez, aient.", comp: "de la patience", act: "kiên nhẫn" },
};

function buildTense(key, word, cfg, formsData) {
  const frame = EXT_FRAMES[key];
  const { forms, alt } = formsData;
  const ruleCtx = { word, pp: cfg.pp, fut: cfg.fut, impfNote: cfg.impfNote, subjNote: cfg.subjNote, auxName: cfg.aux === "etre" ? "être" : "avoir" };
  const makeItem = (p) => {
    const label = pronText(p, forms[p]);
    return {
      before: elide(frame.before.replace("{P}", label)),
      after: frame.after.replace("{C}", cfg.comp),
      answer: forms[p],
      ...(alt?.[p] ? { alt: alt[p] } : {}),
      hint: word,
      explain_vi: frame.signal,
    };
  };
  const exItem = makeItem(frame.prons[0]);
  return {
    rule_vi: frame.rule(ruleCtx),
    forms,
    ...(alt ? { alt } : {}),
    examples: [
      {
        fr: `${exItem.before}${exItem.answer}${exItem.after}`,
        vi: frame.vi(PRON_VI[frame.prons[0]], cfg.act),
      },
    ],
    cloze: frame.prons.map(makeItem),
  };
}

function buildExtended(word, cfg) {
  const aux = cfg.aux === "etre" ? ETRE_AUX : AVOIR_AUX;
  const comp = cfg.aux === "etre" ? (a) => compE(a, cfg.pp) : (a) => compA(a, cfg.pp);
  const data = {
    imparfait: { forms: impf(cfg.impf[0], cfg.impf[1]) },
    futur_simple: { forms: futS(cfg.fut) },
    plus_que_parfait: comp(aux.impf),
    futur_anterieur: comp(aux.fut),
    passe_simple: { forms: cfg.ps },
    passe_anterieur: comp(aux.ps),
    subj_present: { forms: cfg.subj },
    subj_passe: comp(aux.subj),
    subj_imparfait: { forms: cfg.subjImpf },
    subj_plus_que_parfait: comp(aux.subjImpf),
    cond_present: { forms: condP(cfg.fut) },
    cond_passe: comp(aux.cond),
  };
  return Object.fromEntries(
    Object.entries(data).map(([key, formsData]) => [key, buildTense(key, word, cfg, formsData)])
  );
}

for (const w of words) {
  const cfg = EXT[w.word];
  if (cfg) Object.assign(w.conjugations, buildExtended(w.word, cfg));
}
