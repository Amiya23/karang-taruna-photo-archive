import { YearCard } from "./year-card";
import { ArchiveEmptyState } from "@/components/shared/archive-empty-state";
import type { ArchiveSummary } from "@/lib/supabase/queries";

export function ArchiveSection({ archives }: { archives: ArchiveSummary[] }) {
  return (
    <section
      id="arsip"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-16 lg:py-24"
    >
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-flagred-600">
          Arsip
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
          Perjalanan dari tahun ke tahun
        </h2>
        <p className="mt-3 text-charcoal/70">
          Pilih tahun untuk menelusuri rangkaian acara dan galeri fotonya.
          Arsip baru akan tampil otomatis di sini begitu dipublikasikan.
        </p>
      </div>

      {archives.length === 0 ? (
        <div className="mt-10">
          <ArchiveEmptyState />
        </div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {archives.map((archive) => (
            <YearCard key={archive.id} archive={archive} />
          ))}
        </div>
      )}
    </section>
  );
}
