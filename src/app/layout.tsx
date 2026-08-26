import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arsip Dokumentasi 17 Agustus — Karang Taruna RT016",
  description:
    "Arsip foto digital dokumentasi perayaan 17 Agustus Karang Taruna RT016.",
  // Resolve relative OG/Twitter image URLs against the deployed origin.
  // Falls back to localhost for dev; production must set NEXT_PUBLIC_SITE_URL.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  // Reuse the approved brand logo as the favicon (no duplicate asset).
  icons: {
    icon: "/brand/karang-taruna-logo.png",
  },
  openGraph: {
    images: ["/brand/karang-taruna-logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/brand/karang-taruna-logo.png"],
  },
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
