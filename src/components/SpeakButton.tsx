"use client";

import { useEffect, useState } from "react";

/** Nút loa phát âm tiếng Anh bằng TTS của trình duyệt. Ẩn nếu máy không có voice en. */
export default function SpeakButton({ text, className = "" }: { text: string; className?: string }) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const check = () =>
      setAvailable(window.speechSynthesis.getVoices().some((v) => v.lang.startsWith("en")));
    check();
    window.speechSynthesis.addEventListener("voiceschanged", check);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", check);
  }, []);

  if (!available) return null;

  const speak = () => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("en"));
    if (voice) u.voice = voice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  return (
    <button type="button" onClick={speak} aria-label="Phát âm" className={`text-xl ${className}`}>
      🔊
    </button>
  );
}
