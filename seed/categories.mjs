// Danh mục category chuẩn — mỗi từ thuộc ĐÚNG 1 category (nhóm chia theo présent).
// Tính chất bổ sung (phản thân, khiếm khuyết, đi với être) KHÔNG phải category —
// chúng nằm trong basics_vi / rule_vi / alt của từng từ.
// Thêm category mới: thêm dòng ở đây rồi `npm run seed`. KHÔNG đổi slug đã dùng.

export const categories = [
  { slug: "nhom-er", name: "Động từ nhóm 1 (-er)", sort_order: 1, description: "1er groupe: parler, regarder… chia quy tắc -e/-es/-e/-ons/-ez/-ent" },
  { slug: "nhom-ir", name: "Động từ nhóm 2 (-ir)", sort_order: 2, description: "2e groupe: finir, choisir… kiểu -is/-is/-it/-issons/-issez/-issent" },
  { slug: "nhom-3", name: "Động từ nhóm 3 (bất quy tắc)", sort_order: 3, description: "3e groupe: être, avoir, aller, prendre, vouloir… và mọi động từ bất quy tắc" },
];
