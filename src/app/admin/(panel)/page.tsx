import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAdminStats, getRecentArchives } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard Admin — Karang Taruna",
};

const calendarIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-5 w-5" aria-hidden>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </svg>
);

const layersIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-5 w-5" aria-hidden>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </svg>
);

const photoIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-5 w-5" aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m5 19 5.5-5.5a1.5 1.5 0 0 1 2.1 0L19 19.5" />
  </svg>
);

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [stats, recentArchives] = await Promise.all([
    getAdminStats(),
    getRecentArchives(5),
  ]);

  const displayName = user?.email?.split("@")[0] ?? "Admin";

  const statCards = [
    { label: "Tahun Arsip", value: stats.archives, accent: "bg-navy-900", icon: calendarIcon },
    { label: "Acara", value: stats.events, accent: "bg-gold-500 text-navy-950", icon: layersIcon },
    { label: "Foto", value: stats.photos, accent: "bg-flagred-600", icon: photoIcon },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
          Selamat datang, {displayName}
        </h1>
        <p className="mt-1 text-sm text-charcoal/60">
          Ringkasan arsip dokumentasi 17 Agustus Karang Taruna.
        </p>
      </header>

      <section aria-label="Ringkasan statistik" className="grid gap-4 sm:grid-cols-3">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="flex items-center gap-4 rounded-xl border border-cloudgray bg-white p-5 shadow-sm"
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white ${card.accent}`}
            >
              {card.icon}
            </span>
            <div>
              <p className="text-2xl font-bold tabular-nums text-navy-900">
                {card.value}
              </p>
              <p className="text-xs uppercase tracking-wider text-charcoal/50">
                {card.label}
              </p>
            </div>
          </div>
        ))}
      </section>

      <section
        aria-label="Tahun terbaru"
        className="overflow-hidden rounded-xl border border-cloudgray bg-white shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cloudgray px-5 py-4">
          <h2 className="font-semibold text-navy-900">Tahun Terbaru</h2>
          <Link
            href="/admin/archives"
            className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-offwhite transition-colors hover:bg-navy-800"
          >
            Kelola Arsip
          </Link>
        </div>

        {recentArchives.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-charcoal/55">
            Belum ada tahun arsip. Tambahkan lewat pengelolaan arsip.
          </p>
        ) : (
          <ul className="divide-y divide-cloudgray">
            {recentArchives.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="font-semibold text-navy-900">{row.year}</p>
                  <p className="truncate text-xs text-charcoal/55">{row.title}</p>
                </div>
                <span className="shrink-0 rounded-full border border-cloudgray px-3 py-1 text-[11px] text-charcoal/60">
                  {row.eventCount} acara
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
