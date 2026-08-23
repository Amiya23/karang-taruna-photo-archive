import Image from "next/image";

export function ArchiveEmptyState() {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-cloudgray bg-white px-6 py-14 text-center">
      <Image
        src="/brand/karang-taruna-logo.png"
        alt=""
        width={56}
        height={56}
        className="h-14 w-auto opacity-70"
      />
      <h3 className="mt-4 text-lg font-semibold text-navy-900">
        Belum ada arsip yang dipublikasikan
      </h3>
      <p className="mt-2 max-w-sm text-sm text-charcoal/60">
        Dokumentasi tahunan akan tampil di sini setelah ditambahkan oleh
        pengurus.
      </p>
    </div>
  );
}
