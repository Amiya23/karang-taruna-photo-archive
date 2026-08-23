export function EventsEmptyState({ year }: { year: number }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-cloudgray bg-white px-6 py-14 text-center">
      <span className="text-4xl font-bold text-navy-900/15">{year}</span>
      <h3 className="mt-3 text-lg font-semibold text-navy-900">
        Belum ada dokumentasi untuk tahun ini
      </h3>
      <p className="mt-2 max-w-sm text-sm text-charcoal/60">
        Acara dan galeri foto akan muncul di sini setelah diunggah oleh
        pengurus.
      </p>
    </div>
  );
}
