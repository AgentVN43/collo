import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext", "vietnamese"],
});

export const metadata: Metadata = {
  title: "Folask — Luyện chia động từ tiếng Pháp",
  description: "Rèn phản xạ chia động từ tiếng Pháp trong ngữ cảnh câu, dành cho người Việt.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png", // iOS chỉ đọc PNG, không đọc icon trong manifest
  },
  appleWebApp: {
    capable: true,
    title: "Folask",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${inter.variable} antialiased`}>
      <body className="bg-gray-100 text-gray-900">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
