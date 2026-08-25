import { createPublicClient } from "./public";
import { eventSlug } from "@/lib/slug";

export { photoPublicUrl, resolveImageUrl } from "@/lib/photo-url";
export { eventSlug } from "@/lib/slug";

export type ArchiveSummary = {
  id: string;
  year: number;
  title: string;
  description: string | null;
  coverImage: string | null;
};

export type GalleryPhoto = {
  id: string;
  storagePath: string;
  filename: string;
  caption: string | null;
  eventName: string | null;
  year: number | null;
};

function singular<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getArchives(): Promise<ArchiveSummary[]> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("archives")
      .select("id, year, title, description, cover_image")
      .order("year", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id,
      year: row.year,
      title: row.title,
      description: row.description ?? null,
      coverImage: row.cover_image ?? null,
    }));
  } catch (error) {
    console.error("[getArchives]", error);
    return [];
  }
}

export async function getGalleryHighlights(
  limit = 6
): Promise<GalleryPhoto[]> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("photos")
      .select(
        "id, storage_path, filename, caption, event:events(name, archive:archives(year))"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data ?? []).map((row) => {
      const event = singular(row.event);
      const archive = singular(event?.archive);

      return {
        id: row.id,
        storagePath: row.storage_path,
        filename: row.filename ?? "",
        caption: row.caption ?? null,
        eventName: event?.name ?? null,
        year: archive?.year ?? null,
      };
    });
  } catch (error) {
    console.error("[getGalleryHighlights]", error);
    return [];
  }
}

export type ArchiveDetail = ArchiveSummary & {
  description: string | null;
};

export type EventSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  photoCount: number;
};

export async function getArchiveByYear(
  year: number
): Promise<ArchiveDetail | null> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("archives")
      .select("id, year, title, description, cover_image")
      .eq("year", year)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      year: data.year,
      title: data.title,
      description: data.description ?? null,
      coverImage: data.cover_image ?? null,
    };
  } catch (error) {
    console.error("[getArchiveByYear]", error);
    return null;
  }
}

export async function getEventsByArchive(
  archiveId: string
): Promise<EventSummary[]> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("events")
      .select("id, name, description, cover_image, photos(count)")
      .eq("archive_id", archiveId)
      .order("name", { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const rawCount = Array.isArray(row.photos)
        ? row.photos[0]?.count
        : undefined;

      return {
        id: row.id,
        name: row.name,
        slug: eventSlug(row.name),
        description: row.description ?? null,
        coverImage: row.cover_image ?? null,
        photoCount: Number.isFinite(Number(rawCount)) ? Number(rawCount) : 0,
      };
    });
  } catch (error) {
    console.error("[getEventsByArchive]", error);
    return [];
  }
}

export type EventPhoto = {
  id: string;
  storagePath: string;
  filename: string;
  caption: string | null;
};

export async function getPhotosByEvent(eventId: string): Promise<EventPhoto[]> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("photos")
      .select("id, storage_path, filename, caption")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id,
      storagePath: row.storage_path,
      filename: row.filename ?? "",
      caption: row.caption ?? null,
    }));
  } catch (error) {
    console.error("[getPhotosByEvent]", error);
    return [];
  }
}

export type AdminStats = {
  archives: number;
  events: number;
  photos: number;
};

export async function getAdminStats(): Promise<AdminStats> {
  try {
    const supabase = createPublicClient();
    const [archives, events, photos] = await Promise.all([
      supabase.from("archives").select("id", { count: "exact", head: true }),
      supabase.from("events").select("id", { count: "exact", head: true }),
      supabase.from("photos").select("id", { count: "exact", head: true }),
    ]);

    return {
      archives: archives.count ?? 0,
      events: events.count ?? 0,
      photos: photos.count ?? 0,
    };
  } catch (error) {
    console.error("[getAdminStats]", error);
    return { archives: 0, events: 0, photos: 0 };
  }
}

/**
 * Total bytes stored in the "photos" Storage bucket.
 *
 * The photos table does NOT store file size, so we ask Supabase Storage directly.
 * `list()` returns one folder level and exposes `metadata.size` for objects and
 * `id` for folder markers. We walk the tree recursively. This is server-side
 * only (uses the public client — the bucket is public and RLS allows listing) and
 * never exposes a service-role key. No DB schema change is required.
 *
 * Returns 0 on any error (the card degrades gracefully to "0 B").
 */
export async function getStorageUsageBytes(): Promise<number> {
  try {
    const supabase = createPublicClient();
    const bucket = "photos";
    return await sumPrefix(supabase, bucket, "");
  } catch (error) {
    console.error("[getStorageUsageBytes]", error);
    return 0;
  }
}

async function sumPrefix(
  supabase: ReturnType<typeof createPublicClient>,
  bucket: string,
  prefix: string
): Promise<number> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(prefix, { limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } });
  if (error) throw error;
  if (!data || data.length === 0) return 0;

  let total = 0;
  for (const item of data) {
    // Folder marker (no metadata.size) -> recurse into the sub-prefix.
    if (item.metadata && typeof item.metadata.size === "number") {
      total += item.metadata.size;
    } else if (item.id) {
      const nextPrefix = prefix ? `${prefix}/${item.name}` : item.name;
      total += await sumPrefix(supabase, bucket, nextPrefix);
    }
  }
  return total;
}

export type AdminArchiveRow = {
  id: string;
  year: number;
  title: string;
  eventCount: number;
};

export async function getRecentArchives(
  limit = 5
): Promise<AdminArchiveRow[]> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("archives")
      .select("id, year, title, events(count)")
      .order("year", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data ?? []).map((row) => {
      const rawCount = Array.isArray(row.events)
        ? row.events[0]?.count
        : undefined;

      return {
        id: row.id,
        year: row.year,
        title: row.title,
        eventCount: Number.isFinite(Number(rawCount)) ? Number(rawCount) : 0,
      };
    });
  } catch (error) {
    console.error("[getRecentArchives]", error);
    return [];
  }
}
