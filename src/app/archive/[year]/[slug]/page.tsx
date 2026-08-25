import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { EventGallery } from "@/components/gallery/event-gallery";
import { getArchiveByYear, getEventsByArchive, getPhotosByEvent } from "@/lib/supabase/queries";
import { parseYearParam } from "@/lib/route-params";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ year: string; slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { year: rawYear, slug } = await params;
  const year = parseYearParam(rawYear);

  return {
    title:
      year !== null
        ? `Arsip ${year} — ${slug} — Karang Taruna RT016`
        : "Galeri Acara — Karang Taruna RT016",
    description: `Galeri foto acara ${slug} pada dokumentasi perayaan kemerdekaan RI bersama Karang Taruna RT016.`,
  };
}

export default async function EventGalleryPage({ params }: PageProps) {
  const { year: rawYear, slug } = await params;
  const year = parseYearParam(rawYear);
  if (year === null) notFound();

  const archive = await getArchiveByYear(year);
  if (!archive) notFound();

  const events = await getEventsByArchive(archive.id);
  const event = events.find((candidate) => candidate.slug === slug);
  if (!event) notFound();

  const photos = await getPhotosByEvent(event.id);

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
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-2 text-sm animate-fade-up"
            >
              <Link
                href="/archive"
                className="text-offwhite/60 transition-colors hover:text-gold-300"
              >
                Semua Tahun
              </Link>
              <span aria-hidden className="text-offwhite/30">
                /
              </span>
              <Link
                href={`/archive/${archive.year}`}
                className="text-offwhite/60 transition-colors hover:text-gold-300"
              >
                {archive.year}
              </Link>
              <span aria-hidden className="text-offwhite/30">
                /
              </span>
              <span className="font-medium text-gold-300">{event.name}</span>
            </nav>

            <h1 className="mt-5 animate-fade-up text-4xl font-bold tracking-tight sm:text-5xl">
              {event.name}
            </h1>
            {event.description ? (
              <p className="mt-3 max-w-xl animate-fade-up leading-relaxed text-offwhite/70 [animation-delay:100ms]">
                {event.description}
              </p>
            ) : null}
            <p className="mt-4 animate-fade-up text-xs uppercase tracking-[0.2em] text-offwhite/50 [animation-delay:200ms]">
              Dokumentasi 17 Agustus • {archive.year} •{" "}
              {photos.length > 0 ? `${photos.length} foto` : "belum ada foto"}
            </p>
          </div>

          <div className="h-1 w-full bg-gradient-to-r from-flagred-600 via-offwhite/80 to-gold-500" />
        </section>

        <section className="mx-auto w-full max-w-7xl px-6 py-12 lg:py-16">
          {photos.length === 0 ? (
            <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-dashed border-cloudgray bg-white px-6 py-14 text-center">
              <span className="text-4xl font-bold text-navy-900/15">
                {archive.year}
              </span>
              <h2 className="mt-3 text-lg font-semibold text-navy-900">
                Belum ada foto untuk acara ini
              </h2>
              <p className="mt-2 max-w-sm text-sm text-charcoal/60">
                Foto dokumentasi akan tampil di sini setelah diunggah oleh
                pengurus.
              </p>
            </div>
          ) : (
            <EventGallery
              photos={photos}
              eventName={event.name}
              year={archive.year}
            />
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
