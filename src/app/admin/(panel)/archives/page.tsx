import type { Metadata } from "next";
import Link from "next/link";
import { ArchiveForm } from "@/components/admin/archive-form";
import { DeleteForm } from "@/components/admin/delete-form";
import { Disclosure } from "@/components/admin/disclosure";
import {
  createArchive,
  deleteArchive,
  updateArchive,
} from "./actions";
import { getArchives, getRecentArchives } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kelola Arsip — Admin Karang Taruna",
};

export default async function AdminArchivesPage() {
  const [archives, withCounts] = await Promise.all([
    getArchives(),
    getRecentArchives(1000),
  ]);

  const countByYear = new Map(
    withCounts.map((row) => [row.year, row.eventCount])
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Kelola Arsip
          </h1>
          <p className="mt-1 text-sm text-charcoal/60">
            Tambah, ubah, dan hapus tahun arsip dokumentasi.
          </p>
        </div>
        <Disclosure label="Tambah Tahun" variant="primary">
          <ArchiveForm action={createArchive} submitLabel="Tambah Tahun" />
        </Disclosure>
      </header>

      {archives.length === 0 ? (
        <p className="rounded-xl border border-dashed border-cloudgray bg-white px-5 py-10 text-center text-sm text-charcoal/55">
          Belum ada tahun arsip. Gunakan tombol Tambah Tahun di atas.
        </p>
      ) : (
        <ul className="space-y-4">
          {archives.map((archive) => {
            const eventCount = countByYear.get(archive.year) ?? 0;

            return (
              <li
                key={archive.id}
                className="rounded-xl border border-cloudgray bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-navy-900">
                      {archive.year}
                    </p>
                    <p className="truncate text-sm text-charcoal/70">
                      {archive.title}
                    </p>
                    {archive.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-charcoal/50">
                        {archive.description}
                      </p>
                    ) : null}
                  </div>

                  <span className="shrink-0 rounded-full border border-cloudgray px-3 py-1 text-[11px] text-charcoal/60">
                    {eventCount} acara
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/archives/${archive.year}`}
                    className="rounded-lg bg-navy-900 px-3.5 py-2 text-sm font-medium text-offwhite transition-colors hover:bg-navy-800"
                  >
                    Kelola Event
                  </Link>

                  <Disclosure label="Edit" variant="ghost">
                    <ArchiveForm
                      action={updateArchive}
                      submitLabel="Simpan Perubahan"
                      initial={{
                        id: archive.id,
                        year: archive.year,
                        title: archive.title,
                        description: archive.description,
                        coverImage: archive.coverImage,
                      }}
                    />
                  </Disclosure>

                  <DeleteForm
                    action={deleteArchive}
                    id={archive.id}
                    confirmMessage={`Hapus tahun ${archive.year} beserta ${eventCount} event di dalamnya? Seluruh foto dan file-nya di storage akan ikut dihapus. Tindakan ini permanen.`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
