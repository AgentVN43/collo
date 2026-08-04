import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/serverAdmin";

export const runtime = "nodejs";

/**
 * POST /api/ai/run — TẠM NGƯNG.
 *
 * Logic cũ đọc/ghi trực tiếp cột `words.partnerships` (jsonb) và merge kết quả AI vào đó.
 * Cột đó đã bị bỏ khi chuyển sang mô hình quan hệ (collocations / word_collocations /
 * intents / exercises), nên endpoint này không còn chạy được như trước.
 *
 * Các bảng ai_* và trang /admin/ai được giữ nguyên để dùng lại sau. Trong lúc chờ,
 * soạn nội dung bằng AI ngoài (ChatGPT/Claude…) rồi POST JSON vào /api/words/import —
 * cách này còn an toàn hơn vì bạn soát được JSON trước khi ghi vào DB.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  return NextResponse.json(
    {
      error:
        "AI Center tạm ngưng: schema nội dung đã chuyển sang mô hình quan hệ. " +
        "Hãy soạn nội dung bằng AI ngoài rồi import qua POST /api/words/import.",
    },
    { status: 503 }
  );
}
