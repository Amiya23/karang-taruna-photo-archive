import Link from "next/link";

export default function YearNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-navy-950 px-6 text-center text-offwhite">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-flagred-500">
        404
      </p>
      <h1 className="text-3xl font-bold tracking-tight">Arsip tidak ditemukan</h1>
      <p className="max-w-md text-sm leading-relaxed text-offwhite/60">
        Tahun yang Anda cari belum tersedia dalam arsip dokumentasi Karang
        Taruna.
      </p>
      <Link
        href="/archive"
        className="mt-2 rounded-full bg-gold-500 px-6 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-gold-400"
      >
        Kembali ke Arsip
      </Link>
    </div>
  );
}
