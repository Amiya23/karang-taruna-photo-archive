import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventForm } from "@/components/admin/event-form";
import { DeleteForm } from "@/components/admin/delete-form";
import { Disclosure } from "@/components/admin/disclosure";
import { PhotoUploader } from "@/components/admin/photo-uploader";
import { PhotoManager } from "@/components/admin/photo-manager";
import { CoverPicker } from "@/components/admin/cover-picker";
import {
  createEvent,
  deleteEvent,
  updateEvent,
} from "../../archives/actions";
import {
  eventSlug,
  getArchiveByYear,
  getEventsByArchive,
} from "@/lib/supabase/queries";
import { parseYearParam } from "@/lib/route-params";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ year: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { year } = await params;
  return { title: `Event ${year} — Admin Karang Taruna` };
}

export default async function AdminYearEventsPage({ params }: PageProps) {
  const { year: rawYear } = await params;
  const year = parseYearParam(rawYear);
  if (year === null) notFound();

  const archive = await getArchiveByYear(year);
  if (!archive) notFound();

  const events = await getEventsByArchive(archive.id);
  const b2Enabled = process.env.B2_UPLOAD_ENABLED === "true";

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-charcoal/55">
        <Link href="/admin/archives" className="hover:text-navy-900">
          Kelola Arsip
        </Link>
        <span aria-hidden className="mx-2">
          /
        </span>
        <span className="font-medium text-navy-900">{archive.year}</span>
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Event — {archive.year}
          </h1>
          <p className="mt-1 text-sm text-charcoal/60">{archive.title}</p>
        </div>
        <Disclosure label="Tambah Event" variant="primary">
          <EventForm
            action={createEvent}
            archiveId={archive.id}
            submitLabel="Tambah Event"
          />
        </Disclosure>
      </header>

      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-cloudgray bg-white px-5 py-10 text-center text-sm text-charcoal/55">
          Belum ada event pada tahun ini. Gunakan tombol Tambah Event di atas.
        </p>
      ) : (
        <ul className="space-y-4">
          {events.map((event) => (
            <li
              key={event.id}
              className="rounded-xl border border-cloudgray bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-lg font-bold text-navy-900">
                    {event.name}
                  </p>
                  <span className="mt-1 inline-block rounded bg-offwhite px-2 py-0.5 font-mono text-[11px] text-charcoal/60">
                    /{event.slug}
                  </span>
                  {event.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-charcoal/50">
                      {event.description}
                    </p>
                  ) : null}
                </div>

                <span className="shrink-0 rounded-full border border-cloudgray px-3 py-1 text-[11px] text-charcoal/60">
                  {event.photoCount} foto
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link
                  href={`/archive/${archive.year}/${event.slug}`}
                  className="rounded-lg border border-cloudgray bg-white px-3.5 py-2 text-sm font-medium text-navy-900 transition-colors hover:border-navy-600"
                >
                  Lihat Galeri Publik
                </Link>

                <Disclosure label="Edit" variant="ghost">
                  <EventForm
                    action={updateEvent}
                    submitLabel="Simpan Perubahan"
                    initial={{
                      id: event.id,
                      name: event.name,
                      description: event.description,
                    }}
                  />
                </Disclosure>

                <DeleteForm
                  action={deleteEvent}
                  id={event.id}
                  confirmMessage={`Hapus event "${event.name}"? Seluruh foto dan file-nya di storage akan ikut dihapus. Tindakan ini permanen.`}
                />
              </div>

              <Disclosure label="Upload Foto" variant="ghost">
                <PhotoUploader
                  year={archive.year}
                  eventId={event.id}
                  eventCover={event.coverImage}
                  b2Enabled={b2Enabled}
                />
              </Disclosure>

              <Disclosure label="Kelola Foto">
                <PhotoManager eventId={event.id} />
              </Disclosure>

              <div className="rounded-xl border border-cloudgray bg-white p-5 shadow-sm">
                <CoverPicker eventId={event.id} currentCover={event.coverImage} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-charcoal/45">
        Slug dihitung otomatis dari nama event dan dipakai pada URL publik
        (contoh: {eventSlug("Nama Event")}). Menghapus event akan ikut
        menghapus seluruh foto beserta file-nya di storage.
      </p>
    </div>
  );
}
