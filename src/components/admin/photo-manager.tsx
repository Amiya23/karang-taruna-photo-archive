"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { resolveImageUrl } from "@/lib/photo-url";
import { deletePhotoById } from "@/app/admin/(panel)/archives/actions";

type ManagerPhoto = {
  id: string;
  storagePath: string;
  filename: string;
};

export function PhotoManager({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<ManagerPhoto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(
    null
  );

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("photos")
        .select("id, storage_path, filename")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setPhotos(
        (data ?? []).map((row) => ({
          id: row.id,
          storagePath: row.storage_path,
          filename: row.filename ?? "",
        }))
      );
    } catch {
      setLoadError("Gagal memuat daftar foto.");
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(photo: ManagerPhoto) {
    if (deletingId) return;

    if (
      !window.confirm(
        `Hapus foto "${photo.filename || "tanpa nama"}"? File akan dihapus permanen dari storage.`
      )
    )
      return;

    setDeletingId(photo.id);
    setNotice(null);

    const result = await deletePhotoById(photo.id, eventId);
    setDeletingId(null);

    if (!result.ok) {
      setNotice({ ok: false, message: result.message });
      return;
    }

    setPhotos((prev) =>
      prev ? prev.filter((item) => item.id !== photo.id) : prev
    );
    setNotice({ ok: true, message: "Foto berhasil dihapus." });
    router.refresh();
  }

  if (photos === null && !loadError) {
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="aspect-square animate-pulse rounded-lg bg-cloudgray"
          />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-lg bg-flagred-500/10 px-3 py-2 text-sm text-flagred-600">
        <span>{loadError}</span>
        <button
          type="button"
          onClick={load}
          className="rounded-md border border-flagred-500/40 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-flagred-500/10"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-[0.18em] text-charcoal/50">
        {photos!.length} foto terpasang
      </p>

      {notice ? (
        <p
          role={notice.ok ? "status" : "alert"}
          className={`rounded-md px-3 py-2 text-sm ${
            notice.ok
              ? "bg-emerald-50 text-emerald-700"
              : "bg-flagred-500/10 text-flagred-600"
          }`}
        >
          {notice.message}
        </p>
      ) : null}

      {photos!.length === 0 ? (
        <p className="text-sm text-charcoal/55">
          Belum ada foto pada event ini.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {photos!.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-black/10"
            >
              <Image
                src={resolveImageUrl(photo.storagePath)}
                alt={photo.filename || "Foto event"}
                fill
                sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 160px"
                className={`object-cover transition-opacity ${
                  deletingId === photo.id ? "opacity-40" : "opacity-100"
                }`}
              />

              {deletingId === photo.id ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => handleDelete(photo)}
                disabled={deletingId !== null}
                aria-label={`Hapus foto ${photo.filename || ""}`}
                title="Hapus foto"
                className="absolute right-1.5 top-1.5 rounded-full bg-navy-950/70 p-1.5 text-white opacity-0 transition hover:bg-flagred-600 focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-3.5 w-3.5"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
