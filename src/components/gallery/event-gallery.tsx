"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { usePhotoUrl } from "@/lib/use-photo-url";
import type { EventPhoto } from "@/lib/supabase/queries";

type EventGalleryProps = {
  photos: EventPhoto[];
  eventName: string;
  year: number;
};

export function EventGallery({ photos, eventName, year }: EventGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [loadedIds, setLoadedIds] = useState<ReadonlySet<string>>(new Set());

  const close = useCallback(() => setActiveIndex(null), []);

  const showPrev = useCallback(() => {
    setActiveIndex((current) =>
      current === null ? null : (current - 1 + photos.length) % photos.length
    );
  }, [photos.length]);

  const showNext = useCallback(() => {
    setActiveIndex((current) =>
      current === null ? null : (current + 1) % photos.length
    );
  }, [photos.length]);

  const markLoaded = useCallback((id: string) => {
    setLoadedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (activeIndex === null) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowLeft") showPrev();
      else if (event.key === "ArrowRight") showNext();
    }

    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [activeIndex, close, showPrev, showNext]);

  const activePhoto = activeIndex !== null ? photos[activeIndex] : null;

  return (
    <>
      <div className="columns-2 gap-4 sm:gap-5 md:columns-3 xl:columns-4">
        {photos.map((photo, index) => {
          const loaded = loadedIds.has(photo.id);

          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Lihat foto ${index + 1} dari ${photos.length}`}
              className="group relative mb-4 block w-full cursor-zoom-in break-inside-avoid overflow-hidden rounded-xl bg-cloudgray ring-1 ring-black/5 transition duration-300 hover:ring-gold-500/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 sm:mb-5"
            >
              <GalleryImage
                storagePath={photo.storagePath}
                photoId={photo.id}
                alt={photo.caption || photo.filename || `Foto ${index + 1}`}
                width={960}
                height={960}
                onLoad={() => markLoaded(photo.id)}
              />
              {!loaded ? (
                <span className="absolute inset-0 animate-pulse bg-cloudgray" />
              ) : null}
            </button>
          );
        })}
      </div>

      {activePhoto ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${eventName} — foto ${activeIndex! + 1} dari ${photos.length}`}
          className="fixed inset-0 z-[100] flex flex-col bg-navy-950/95 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="flex items-center justify-between px-4 py-3 sm:px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs uppercase tracking-[0.2em] text-offwhite/60">
              {activeIndex! + 1} / {photos.length}
            </span>
            <a
              href={`/api/photos/${activePhoto.id}/download`}
              download
              aria-label={`Unduh foto ${activeIndex! + 1}`}
              title="Unduh foto"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-2 text-xs font-medium text-offwhite transition-colors hover:bg-white/20"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-4 w-4"
                aria-hidden
              >
                <path d="M12 4v10m0 0 4-4m-4 4-4-4" />
                <path d="M5 19h14" />
              </svg>
              Unduh
            </a>

            <button
              type="button"
              onClick={close}
              aria-label="Tutup galeri"
              className="rounded-full border border-white/25 bg-white/10 p-2.5 text-offwhite transition-colors hover:bg-white/20"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-4 w-4"
                aria-hidden
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center gap-2 px-2 sm:px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={showPrev}
              aria-label="Foto sebelumnya"
              className="shrink-0 rounded-full border border-white/25 bg-white/10 p-3 text-offwhite transition-colors hover:bg-white/20"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-5 w-5"
                aria-hidden
              >
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>

            <div className="relative mx-auto min-h-0 w-full max-w-5xl flex-1 self-stretch">
              <GalleryImage
                storagePath={activePhoto.storagePath}
                photoId={activePhoto.id}
                alt={activePhoto.caption || activePhoto.filename || "Foto"}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="animate-fade-up object-contain"
              />
            </div>

            <button
              type="button"
              onClick={showNext}
              aria-label="Foto berikutnya"
              className="shrink-0 rounded-full border border-white/25 bg-white/10 p-3 text-offwhite transition-colors hover:bg-white/20"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-5 w-5"
                aria-hidden
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>

          <div
            className="px-6 py-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-offwhite/85">
              {activePhoto.caption || activePhoto.filename}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gold-300/80">
              {eventName} • {year}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * Resolves a photo's storage_path to a renderable image URL via usePhotoUrl
 * (legacy Supabase public URL, or a server-generated B2 presigned URL). Keeping
 * the resolution in a child component lets us call the hook per-photo while the
 * parent maps over the list.
 */
function GalleryImage({
  storagePath,
  photoId,
  alt,
  fill,
  priority,
  sizes,
  className,
  onLoad,
  width,
  height,
}: {
  storagePath: string;
  photoId?: string;
  alt: string;
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
  className?: string;
  onLoad?: () => void;
  width?: number;
  height?: number;
}) {
  const url = usePhotoUrl({ id: photoId, storagePath });
  if (!url) {
    return <div className="absolute inset-0 animate-pulse bg-cloudgray" />;
  }
  return (
    <Image
      src={url}
      alt={alt}
      fill={fill}
      priority={priority}
      sizes={sizes}
      width={width}
      height={height}
      className={className}
      onLoad={onLoad}
    />
  );
}
