import Image from "next/image";
import Link from "next/link";
import {
  resolveImageUrl,
  type ArchiveSummary,
} from "@/lib/supabase/queries";

export function YearCard({ archive, coverUrl }: { archive: ArchiveSummary; coverUrl?: string }) {
  const coverSrc = coverUrl ?? (archive.coverImage ? resolveImageUrl(archive.coverImage) : null);
  return (
    <Link
      href={`/archive/${archive.year}`}
      className="group block overflow-hidden rounded-2xl bg-navy-900 ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-navy-950/15"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {archive.coverImage ? (
          <>
            <Image
              src={coverSrc ?? resolveImageUrl(archive.coverImage)}
              alt={`Cover arsip tahun ${archive.year}`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy-950/55 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-navy-700 via-navy-800 to-navy-900">
            <span className="absolute inset-0 flex items-center justify-center text-6xl font-bold text-white/10">
              {archive.year}
            </span>
            <span className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-flagred-600 via-offwhite/70 to-gold-400" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-lg font-bold text-offwhite">{archive.year}</p>
          <p className="truncate text-xs text-offwhite/60">{archive.title}</p>
        </div>
        <span
          aria-hidden
          className="shrink-0 text-gold-400 transition-transform duration-300 group-hover:translate-x-1"
        >
          →
        </span>
      </div>
    </Link>
  );
}
