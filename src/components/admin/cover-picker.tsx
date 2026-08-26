"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { usePhotoUrl } from "@/lib/use-photo-url";
import { setEventCover } from "@/app/admin/(panel)/archives/actions";

type CoverPhoto = {
  id: string;
  storagePath: string;
  filename: string;
};

/**
 * Client-side cover picker. Lists the event's own uploaded photos as thumbnails
 * and lets the admin pick one. The actual persistence is done by the server
 * action setEventCover(), which re-verifies ownership and resolves the
 * storage_path from the database — the browser never supplies a raw path.
 */
export function CoverPicker({
  eventId,
  currentCover,
}: {
  eventId: string;
  currentCover: string | null;
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState<CoverPhoto[] | null>(null);
  const [selected, setSelected] = useState<string | null>(currentCover);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("photos")
          .select("id, storage_path, filename")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        if (cancelled) return;
        setPhotos(
          (data ?? []).map((row) => ({
            id: row.id,
            storagePath: row.storage_path,
            filename: row.filename ?? "",
          }))
        );
      } catch {
        if (!cancelled) setPhotos([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    setSelected(currentCover);
  }, [currentCover]);

  const choose = useCallback(
    async (photo: CoverPhoto) => {
      if (pendingId) return;
      setPendingId(photo.id);
      setNotice(null);
      const result = await setEventCover(eventId, photo.id);
      setPendingId(null);
      if (!result || !result.ok) {
        setNotice({
          ok: false,
          message: result?.message ?? "Gagal menetapkan cover.",
        });
        return;
      }
      setSelected(photo.storagePath);
      setNotice({ ok: true, message: result.message });
      router.refresh();
    },
    [eventId, pendingId, router]
  );

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-[0.18em] text-charcoal/50">
        Cover Event
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

      {photos === null ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="aspect-square animate-pulse rounded-lg bg-cloudgray"
            />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <p className="text-sm text-charcoal/55">
          Belum ada foto pada event ini. Unggah foto terlebih dahulu untuk
          menetapkan cover.
        </p>
      ) : (
        <>
          {!selected ? (
            <p className="text-xs text-charcoal/50">Belum ada cover.</p>
          ) : null}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {photos.map((photo) => {
              const isCover = photo.storagePath === selected;
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => choose(photo)}
                  disabled={pendingId !== null}
                  aria-pressed={isCover}
                  aria-label={
                    isCover
                      ? `Cover saat ini: ${photo.filename || "foto"}`
                      : `Jadikan cover: ${photo.filename || "foto"}`
                  }
                  className={`group relative aspect-square overflow-hidden rounded-lg ring-2 transition ${
                    isCover
                      ? "ring-gold-500"
                      : "ring-black/10 hover:ring-navy-600/40"
                  } ${pendingId !== null ? "opacity-70" : ""}`}
                >
                  <CoverPhotoImage storagePath={photo.storagePath} photoId={photo.id} alt={photo.filename || "Foto event"} />
                  {isCover ? (
                    <span className="absolute bottom-1 left-1 rounded-full bg-gold-500 px-2 py-0.5 text-[10px] font-semibold text-navy-950">
                      Cover
                    </span>
                  ) : null}
                  {pendingId === photo.id ? (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** Per-photo thumbnail that resolves B2 presigned URLs server-side via usePhotoUrl. */
function CoverPhotoImage({ storagePath, photoId, alt }: { storagePath: string; photoId?: string; alt: string }) {
  const url = usePhotoUrl({ id: photoId, storagePath });
  if (!url) {
    return <div className="absolute inset-0 animate-pulse bg-cloudgray" />;
  }
  return (
    <Image
      src={url}
      alt={alt}
      fill
      sizes="(max-width: 640px) 33vw, 160px"
      className="object-cover"
    />
  );
}
