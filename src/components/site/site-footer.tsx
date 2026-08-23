import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-navy-950 text-offwhite/60">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" />
        <div className="mt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/brand/karang-taruna-logo.png"
              alt="Logo Karang Taruna"
              width={40}
              height={40}
              className="h-9 w-auto"
            />
            <span className="text-sm text-offwhite/80">
              Karang Taruna — Arsip Dokumentasi 17 Agustus
            </span>
          </Link>
          <p className="text-xs">© {year} Karang Taruna</p>
        </div>
      </div>
    </footer>
  );
}
