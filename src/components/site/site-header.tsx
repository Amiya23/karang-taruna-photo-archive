import Image from "next/image";
import Link from "next/link";

const navItems = [
  { href: "/", label: "Beranda" },
  { href: "/archive", label: "Arsip Foto" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-navy-950/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/brand/karang-taruna-logo.png"
            alt="Logo Karang Taruna"
            width={48}
            height={48}
            priority
            className="h-11 w-auto"
          />
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-offwhite">
              Karang Taruna RT016
            </span>
            <span className="block text-[11px] uppercase tracking-[0.2em] text-gold-300">
              Arsip 17 Agustus
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-5 sm:gap-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-offwhite/75 transition-colors hover:text-gold-300"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
