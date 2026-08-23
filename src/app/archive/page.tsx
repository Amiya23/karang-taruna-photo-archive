import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { YearCard } from "@/components/home/year-card";
import { ArchiveEmptyState } from "@/components/shared/archive-empty-state";
import { getArchives } from "@/lib/supabase/queries";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Arsip Foto — Karang Taruna",
  description:
    "Daftar tahun dokumentasi perayaan kemerdekaan RI bersama Karang Taruna.",
};

export default async function ArchivePage() {
  const archives = await getArchives();

  return (
    <div className="flex min-h-screen flex-col bg-offwhite">
      <SiteHeader />

      <main className="flex-1">
        <section className="relative overflow-hidden bg-navy-950 text-offwhite">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-28 right-[-8%] h-80 w-80 rounded-full bg-gold-500/15 blur-3xl" />
            <div className="absolute -bottom-24 left-[-8%] h-72 w-72 rounded-full bg-flagred-600/15 blur-3xl" />
          </div>

          <div className="relative mx-auto w-full max-w-6xl px-6 py-14 lg:py-20">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] text-gold-300">
              <span className="h-1.5 w-1.5 rounded-full bg-flagred-500" />
              Arsip
            </p>
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Arsip Foto Dokumentasi
            </h1>
            <p className="mt-4 max-w-xl text-offwhite/70">
              Seluruh tahun perayaan yang sudah terdokumentasi. Pilih satu
              tahun untuk melihat rangkaian acaranya.
            </p>

            {archives.length > 0 ? (
              <p className="mt-6 inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] text-offwhite/70">
                {archives.length} tahun terdokumentasi
              </p>
            ) : null}
          </div>

          <div className="h-1 w-full bg-gradient-to-r from-flagred-600 via-offwhite/80 to-gold-500" />
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-12 lg:py-16">
          {archives.length === 0 ? (
            <ArchiveEmptyState />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {archives.map((archive, index) => (
                <div
                  key={archive.id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${Math.min(index, 7) * 60}ms` }}
                >
                  <YearCard archive={archive} />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
