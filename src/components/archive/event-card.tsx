import Image from "next/image";
import Link from "next/link";
import { resolveImageUrl, type EventSummary } from "@/lib/supabase/queries";

export function EventCard({
  event,
  year,
}: {
  event: EventSummary;
  year: number;
}) {
  return (
    <Link
      href={`/archive/${year}/${event.slug}`}
      className="group block overflow-hidden rounded-2xl bg-navy-900 ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-navy-950/15"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        {event.coverImage ? (
          <>
            <Image
              src={resolveImageUrl(event.coverImage)}
              alt={`Cover acara ${event.name}`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy-950/55 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-navy-700 via-navy-800 to-navy-900">
            <span className="absolute inset-0 flex items-center justify-center text-5xl font-bold uppercase text-white/10">
              {event.name.charAt(0)}
            </span>
            <span className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-flagred-600 via-offwhite/70 to-gold-400" />
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="font-semibold text-offwhite">{event.name}</h3>
        {event.description ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-offwhite/60">
            {event.description}
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gold-300">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-3.5 w-3.5"
              aria-hidden
            >
              <path d="M4 7h3l2-2h6l2 2h3v12H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            {event.photoCount} foto
          </span>
          <span
            aria-hidden
            className="text-gold-400 transition-transform duration-300 group-hover:translate-x-1"
          >
            →
          </span>
        </div>
      </div>
    </Link>
  );
}
