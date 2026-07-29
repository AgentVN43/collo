"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import { getSupabase } from "@/lib/supabase";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const supabase = getSupabase();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError("Chưa cấu hình Supabase (.env.local).");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace(next);
  };

  return (
    <form onSubmit={submit} className="px-4 py-6 space-y-4">
      <h2 className="text-xl font-bold">
        {mode === "signin" ? "Đăng nhập" : "Tạo tài khoản"}
      </h2>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
      />
      <input
        type="password"
        required
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Mật khẩu (≥ 6 ký tự)"
        className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-blue-600 py-3 text-white font-semibold disabled:opacity-50"
      >
        {busy ? "Đang xử lý…" : mode === "signin" ? "Đăng nhập" : "Đăng ký"}
      </button>
      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="w-full text-sm text-blue-600"
      >
        {mode === "signin" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div>
      <TopBar title="Tài khoản" back />
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
