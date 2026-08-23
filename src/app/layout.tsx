import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arsip Dokumentasi 17 Agustus — Karang Taruna",
  description:
    "Arsip foto digital dokumentasi perayaan 17 Agustus Karang Taruna.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
