"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function TopBar({
  title,
  back = false,
  settings = false,
  wide = false,
}: {
  title: string;
  back?: boolean;
  settings?: boolean;
  wide?: boolean;
}) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className={`h-12 flex items-center px-2 ${wide ? "" : "mx-auto max-w-md"}`}>
        <div className="w-10">
          {back && (
            <button
              onClick={() => router.back()}
              aria-label="Quay lại"
              className="p-2 text-xl text-gray-700"
            >
              ←
            </button>
          )}
        </div>
        <h1 className="flex-1 text-center font-semibold text-gray-900 truncate">{title}</h1>
        <div className="w-10 text-right">
          {settings && (
            <Link href="/settings" aria-label="Cài đặt" className="p-2 text-xl inline-block">
              ⚙️
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
