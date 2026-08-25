import Image from "next/image";
import Link from "next/link";
import {
  type GalleryPhoto,
} from "@/lib/supabase/queries";

type HeroProps = {
  photos: (GalleryPhoto & { url: string })[];
  yearsCount: number;
};

export function HomeHero({ photos, yearsCount }: HeroProps) {
  const tiles = photos.slice(0, 3);

  return (
    <section className="relative overflow-hidden bg-navy-950 text-offwhite">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 right-[-8%] h-[28rem] w-[28rem] rounded-full bg-gold-500/15 blur-3xl" />
        <div className="absolute bottom-[-30%] left-[-8%] h-[26rem] w-[26rem] rounded-full bg-flagred-600/15 blur-3xl" />
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-24">
        <div>
          <p className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] text-gold-300">
            <span className="h-1.5 w-1.5 rounded-full bg-flagred-500" />
            Arsip Dokumentasi Karang Taruna RT016/RW005 Kelurahan Cibubur
          </p>

          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="block animate-fade-up">Merayakan.</span>
            <span className="block animate-fade-up text-gold-400 [animation-delay:120ms]">
              Mengabadikan.
            </span>
            <span className="block animate-fade-up [animation-delay:240ms]">
              Mengenang.
            </span>
          </h1>

          <p className="mt-6 max-w-md animate-fade-up text-base leading-relaxed text-offwhite/70 [animation-delay:360ms] sm:text-lg">
            Kumpulan foto perayaan kemerdekaan RI bersama Karang Taruna RT016 —
            dari lomba, karnaval, hingga tasyakuran. Satu tempat untuk
            menelusuri semangat tujuh belasan dari tahun ke tahun.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4 animate-fade-up [animation-delay:480ms]">
            <Link
              href="/archive"
              className="rounded-full bg-gold-500 px-6 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-gold-400"
            >
              Jelajahi Arsip
            </Link>
            <Link
              href="#arsip"
              className="rounded-full border border-white/20 px-6 py-3 text-sm text-offwhite/85 transition-colors hover:border-gold-300/60 hover:text-gold-300"
            >
              Lihat Tahun
            </Link>
          </div>

          {yearsCount > 0 ? (
            <p className="mt-8 animate-fade-up text-xs uppercase tracking-[0.2em] text-offwhite/45 [animation-delay:600ms]">
              {yearsCount} tahun terdokumentasi
            </p>
          ) : null}
        </div>

        <div className="relative mx-auto h-80 w-full max-w-md sm:h-96 lg:h-[27rem]">
          {tiles[0] ? (
            <PhotoTile photo={tiles[0]} className="-left-2 top-6 h-48 w-36 -rotate-6 sm:h-64 sm:w-48" />
          ) : (
            <PlaceholderTile tint="from-navy-700 to-navy-900" className="-left-2 top-6 h-48 w-36 -rotate-6 sm:h-64 sm:w-48" />
          )}

          {tiles[1] ? (
            <PhotoTile photo={tiles[1]} className="right-0 top-0 z-10 h-64 w-48 rotate-2 sm:h-80 sm:w-60" />
          ) : (
            <PlaceholderTile tint="from-gold-600 to-navy-800" className="right-0 top-0 z-10 h-64 w-48 rotate-2 sm:h-80 sm:w-60" />
          )}

          {tiles[2] ? (
            <PhotoTile photo={tiles[2]} className="bottom-0 left-10 h-44 w-36 rotate-3 sm:h-56 sm:w-44" />
          ) : (
            <PlaceholderTile tint="from-flagred-600 to-navy-900" className="bottom-0 left-10 h-44 w-36 rotate-3 sm:h-56 sm:w-44" />
          )}

          <div className="absolute -bottom-3 right-4 z-20 rounded-full border border-white/15 bg-navy-900/70 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-gold-200 backdrop-blur">
            17 Agustus • Dokumentasi
          </div>
        </div>
      </div>

      <div className="h-1 w-full bg-gradient-to-r from-flagred-600 via-offwhite/80 to-gold-500" />
    </section>
  );
}

function PhotoTile({
  photo,
  className,
}: {
  photo: GalleryPhoto & { url: string };
  className?: string;
}) {
  return (
    <div
      className={`absolute overflow-hidden rounded-2xl shadow-2xl shadow-navy-950/70 ring-1 ring-white/25 ${className}`}
    >
      <Image
        src={photo.url}
        alt={photo.caption ?? photo.filename}
        fill
        sizes="(max-width: 640px) 45vw, 240px"
        className="object-cover"
      />
    </div>
  );
}

function PlaceholderTile({
  tint,
  className,
}: {
  tint: string;
  className?: string;
}) {
  return (
    <div
      className={`absolute overflow-hidden rounded-2xl shadow-2xl shadow-navy-950/70 ring-1 ring-white/15 ${className}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${tint}`}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.2}
          className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-white/20"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="m5 19 5.5-5.5a1.5 1.5 0 0 1 2.1 0L19 19.5" />
        </svg>
      </div>
    </div>
  );
}
