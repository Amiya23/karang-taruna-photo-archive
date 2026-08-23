import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { EventCard } from "@/components/archive/event-card";
import { EventsEmptyState } from "@/components/archive/events-empty-state";
import { getArchiveByYear, getEventsByArchive } from "@/lib/supabase/queries";
import { parseYearParam as parseYear } from "@/lib/route-params";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ year: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { year: rawYear } = await params;
  const year = parseYear(rawYear);

  return {
    title:
      year !== null
        ? `Arsip ${year} — Karang Taruna`
        : "Arsip — Karang Taruna",
    description: `Dokumentasi perayaan kemerdekaan RI tahun ${rawYear} bersama Karang Taruna.`,
  };
}

export default async function YearPage({ params }: PageProps) {
  const { year: rawYear } = await params;
  const year = parseYear(rawYear);
  if (year === null) notFound();

  const archive = await getArchiveByYear(year);
  if (!archive) notFound();

  const events = await getEventsByArchive(archive.id);
  const totalPhotos = events.reduce((sum, event) => sum + event.photoCount, 0);

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
            <nav aria-label="Breadcrumb">
              <Link
                href="/archive"
                className="inline-flex animate-fade-up items-center gap-2 text-sm text-offwhite/60 transition-colors hover:text-gold-300"
              >
                <span aria-hidden>←</span>
                Semua Tahun
              </Link>
            </nav>

            <h1 className="mt-5 animate-fade-up text-4xl font-bold tracking-tight sm:text-5xl">
              {archive.year}
            </h1>
            <p className="mt-3 animate-fade-up text-lg font-medium text-gold-300 [animation-delay:100ms]">
              {archive.title}
            </p>
            {archive.description ? (
              <p className="mt-3 max-w-xl animate-fade-up leading-relaxed text-offwhite/70 [animation-delay:200ms]">
                {archive.description}
              </p>
            ) : null}

            {events.length > 0 || totalPhotos > 0 ? (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {events.length > 0 ? (
                  <span className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] text-offwhite/70">
                    {events.length} acara
                  </span>
                ) : null}
                {totalPhotos > 0 ? (
                  <span className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] text-gold-300">
                    {totalPhotos} foto
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="h-1 w-full bg-gradient-to-r from-flagred-600 via-offwhite/80 to-gold-500" />
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-12 lg:py-16">
          {events.length === 0 ? (
            <EventsEmptyState year={archive.year} />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event, index) => (
                <div
                  key={event.id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${Math.min(index, 7) * 60}ms` }}
                >
                  <EventCard event={event} year={archive.year} />
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
