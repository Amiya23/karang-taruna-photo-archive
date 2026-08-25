"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkUserAdmin } from "@/lib/is-admin";
import { removePhotoObjectsHybrid } from "@/lib/storage-cleanup-hybrid";
import { uploadObject, deleteObject } from "@/lib/b2/storage";
import { isB2Path, stripB2Prefix } from "@/lib/b2/path";

/** Server-side feature flag: route NEW uploads to B2 when enabled. */
function b2UploadEnabled(): boolean {
  return process.env.B2_UPLOAD_ENABLED === "true";
}

export type ActionState = { ok: boolean; message: string } | null;

class ActionError extends Error {}

async function requireAdminClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new ActionError("Sesi berakhir. Silakan login kembali.");

  const check = await checkUserAdmin(supabase, user.id);
  if (check.status === "error")
    throw new ActionError("Verifikasi admin gagal. Coba lagi.");
  if (check.status !== "admin") throw new ActionError("Akses ditolak.");

  return supabase;
}

function toActionState(error: unknown, duplicateMessage: string): ActionState {
  if (error instanceof ActionError)
    return { ok: false, message: error.message };

  const code = (error as { code?: string } | null)?.code;
  if (code === "23505") return { ok: false, message: duplicateMessage };
  if (code === "42501")
    return { ok: false, message: "Akses ditolak oleh kebijakan database." };

  console.error("[admin-action]", error);
  return { ok: false, message: "Terjadi kesalahan. Coba lagi." };
}

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function validateYear(value: string): number | null {
  const year = Number(value);
  if (!/^\d{4}$/.test(value) || !Number.isInteger(year)) return null;
  if (year < 1900 || year > 2999) return null;
  return year;
}

function invalidateAll() {
  revalidatePath("/", "layout");
}

export async function createArchive(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const supabase = await requireAdminClient();

    const yearValue = readString(formData, "year");
    const title = readString(formData, "title");
    const description = readString(formData, "description");
    const coverImage = readString(formData, "coverImage");

    const year = validateYear(yearValue);
    if (year === null)
      return { ok: false, message: "Tahun harus angka 1900–2999." };
    if (!title) return { ok: false, message: "Judul wajib diisi." };
    if (title.length > 200)
      return { ok: false, message: "Judul maksimal 200 karakter." };
    if (description.length > 1000)
      return { ok: false, message: "Deskripsi maksimal 1000 karakter." };
    if (coverImage.length > 500)
      return { ok: false, message: "URL cover maksimal 500 karakter." };

    const { error } = await supabase.from("archives").insert({
      year,
      title,
      description: description || null,
      cover_image: coverImage || null,
    });
    if (error) throw error;

    invalidateAll();
    return { ok: true, message: `Tahun ${year} berhasil ditambahkan.` };
  } catch (error) {
    return toActionState(error, "Tahun tersebut sudah ada.");
  }
}

export async function updateArchive(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const supabase = await requireAdminClient();

    const id = readString(formData, "id");
    const yearValue = readString(formData, "year");
    const title = readString(formData, "title");
    const description = readString(formData, "description");
    const coverImage = readString(formData, "coverImage");

    if (!id) return { ok: false, message: "ID arsip tidak valid." };
    const year = validateYear(yearValue);
    if (year === null)
      return { ok: false, message: "Tahun harus angka 1900–2999." };
    if (!title) return { ok: false, message: "Judul wajib diisi." };
    if (title.length > 200)
      return { ok: false, message: "Judul maksimal 200 karakter." };
    if (description.length > 1000)
      return { ok: false, message: "Deskripsi maksimal 1000 karakter." };
    if (coverImage.length > 500)
      return { ok: false, message: "URL cover maksimal 500 karakter." };

    const { error } = await supabase
      .from("archives")
      .update({
        year,
        title,
        description: description || null,
        cover_image: coverImage || null,
      })
      .eq("id", id);
    if (error) throw error;

    invalidateAll();
    return { ok: true, message: `Tahun ${year} berhasil diperbarui.` };
  } catch (error) {
    return toActionState(error, "Tahun tersebut sudah dipakai arsip lain.");
  }
}

export async function deleteArchive(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const supabase = await requireAdminClient();

    const id = readString(formData, "id");
    if (!id) return { ok: false, message: "ID arsip tidak valid." };

    const { data: archive, error: archiveError } = await supabase
      .from("archives")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (archiveError) throw archiveError;
    if (!archive)
      return { ok: false, message: "Arsip tidak ditemukan." };

    // Collect every photo storage_path under this archive (via its events).
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id")
      .eq("archive_id", id);
    if (eventsError) throw eventsError;

    const eventIds = (events ?? []).map((row) => row.id);
    let photoPaths: string[] = [];

    if (eventIds.length > 0) {
      const { data: photos, error: photosError } = await supabase
        .from("photos")
        .select("storage_path")
        .in("event_id", eventIds);
      if (photosError) throw photosError;
      photoPaths = (photos ?? [])
        .map((row) => row.storage_path)
        .filter((p): p is string => typeof p === "string" && p.length > 0);
    }

    // Storage-first: remove blobs before deleting rows. If Storage fails we
    // abort and leave the database intact (avoids broken public gallery images).
    if (photoPaths.length > 0) {
      const cleanup = await removePhotoObjectsHybrid(supabase, photoPaths);
      if (!cleanup.ok) {
        console.error(
          "[deleteArchive] storage cleanup failed; aborting",
          { archiveId: id, failedCount: cleanup.failed.length }
        );
        return {
          ok: false,
          message:
            "Gagal menghapus file foto dari storage. Penghapusan arsip dibatalkan agar data tidak rusak. Coba lagi.",
        };
      }
    }

    // FK CASCADE handles events -> photos rows.
    const { error } = await supabase.from("archives").delete().eq("id", id);
    if (error) throw error;

    invalidateAll();
    return { ok: true, message: "Arsip tahun berhasil dihapus." };
  } catch (error) {
    return toActionState(error, "Gagal menghapus arsip.");
  }
}

export async function createEvent(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const supabase = await requireAdminClient();

    const archiveId = readString(formData, "archiveId");
    const name = readString(formData, "name");
    const description = readString(formData, "description");

    if (!archiveId) return { ok: false, message: "Arsip tidak valid." };
    if (!name) return { ok: false, message: "Nama event wajib diisi." };
    if (name.length > 120)
      return { ok: false, message: "Nama event maksimal 120 karakter." };
    if (description.length > 500)
      return { ok: false, message: "Deskripsi maksimal 500 karakter." };

    const { error } = await supabase.from("events").insert({
      archive_id: archiveId,
      name,
      description: description || null,
    });
    if (error) throw error;

    invalidateAll();
    return { ok: true, message: `Event "${name}" berhasil ditambahkan.` };
  } catch (error) {
    return toActionState(
      error,
      "Nama event sudah dipakai pada tahun ini."
    );
  }
}

export async function updateEvent(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const supabase = await requireAdminClient();

    const id = readString(formData, "id");
    const name = readString(formData, "name");
    const description = readString(formData, "description");

    if (!id) return { ok: false, message: "ID event tidak valid." };
    if (!name) return { ok: false, message: "Nama event wajib diisi." };
    if (name.length > 120)
      return { ok: false, message: "Nama event maksimal 120 karakter." };
    if (description.length > 500)
      return { ok: false, message: "Deskripsi maksimal 500 karakter." };

    const { error } = await supabase
      .from("events")
      .update({
        name,
        description: description || null,
      })
      .eq("id", id);
    if (error) throw error;

    invalidateAll();
    return { ok: true, message: `Event "${name}" berhasil diperbarui.` };
  } catch (error) {
    return toActionState(
      error,
      "Nama event sudah dipakai pada tahun ini."
    );
  }
}

/**
 * Set an event's cover image by choosing one of its own photos.
 *
 * Security: the client only supplies photoId + eventId. We re-fetch the photo
 * server-side, confirm it belongs to this event (photo.event_id === eventId),
 * and use the DB-resolved storage_path. No arbitrary/raw Storage path is ever
 * accepted from the browser. Admin authorization is enforced by requireAdminClient.
 */
export async function setEventCover(
  eventId: string,
  photoId: string
): Promise<ActionState> {
  try {
    if (!eventId || !photoId)
      return { ok: false, message: "Data cover tidak valid." };

    const supabase = await requireAdminClient();

    const { data: photo, error: photoError } = await supabase
      .from("photos")
      .select("id, event_id, storage_path")
      .eq("id", photoId)
      .maybeSingle();
    if (photoError) throw photoError;
    if (!photo) return { ok: false, message: "Foto tidak ditemukan." };
    if (photo.event_id !== eventId)
      return {
        ok: false,
        message: "Foto bukan milik event ini. Penetapan cover ditolak.",
      };

    const { error } = await supabase
      .from("events")
      .update({ cover_image: photo.storage_path })
      .eq("id", eventId);
    if (error) throw error;

    invalidateAll();
    return { ok: true, message: "Cover event diperbarui." };
  } catch (error) {
    return toActionState(error, "Gagal menetapkan cover event.");
  }
}

/**
 * Upload a NEW photo to Backblaze B2 and insert the DB row.
 *
 * Hybrid strategy: when B2_UPLOAD_ENABLED is true, new uploads go to B2 and are
 * stored with a "b2:"-prefixed storage_path. Legacy/unprefixed paths remain
 * Supabase Storage. B2 credentials stay server-side (this is a server action).
 *
 * Rollback: if the DB insert fails after a successful B2 upload, the orphan B2
 * object is deleted so we never leave dangling blobs.
 */
const B2_ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const B2_MAX_SIZE = 10 * 1024 * 1024;

function sanitizePhotoFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const rawExt = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  const ext = /^.(jpe?g|png|webp)$/.test(rawExt) ? rawExt : "";
  const base = (dot >= 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "foto"}${ext}`;
}

export type UploadPhotoState = { ok: boolean; message: string };

export async function uploadPhotoToB2(
  _prev: UploadPhotoState,
  formData: FormData
): Promise<UploadPhotoState> {
  try {
    if (!b2UploadEnabled()) {
      return { ok: false, message: "Upload B2 tidak diaktifkan." };
    }

    const supabase = await requireAdminClient();

    const eventId = readString(formData, "eventId");
    const year = readString(formData, "year");
    const file = formData.get("file");

    if (!eventId || !year) {
      return { ok: false, message: "Parameter tidak valid." };
    }
    if (!(file instanceof File)) {
      return { ok: false, message: "File tidak ditemukan." };
    }
    if (!B2_ACCEPTED_TYPES.has(file.type)) {
      return { ok: false, message: "Tipe tidak didukung (hanya JPEG/PNG/WebP)." };
    }
    if (file.size > B2_MAX_SIZE) {
      return { ok: false, message: "Ukuran melebihi 10 MB." };
    }
    if (file.size === 0) {
      return { ok: false, message: "File kosong." };
    }

    // Verify the event exists (authz preserved by requireAdminClient).
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, cover_image")
      .eq("id", eventId)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) return { ok: false, message: "Event tidak ditemukan." };

    const key = `${year}/${eventId}/${Date.now()}-${sanitizePhotoFilename(
      file.name
    )}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    // Storage-first: upload blob before inserting the DB row.
    await uploadObject(key, bytes, file.type || "image/jpeg");

    const storagePath = `b2:${key}`;
    const { error: insertError } = await supabase.from("photos").insert({
      event_id: eventId,
      storage_path: storagePath,
      filename: file.name,
    });

    if (insertError) {
      // Rollback the orphan B2 object.
      try {
        await deleteObject(key);
      } catch {
        console.error("[uploadPhotoToB2] rollback gagal hapus B2 object", {
          key,
        });
      }
      return { ok: false, message: "Gagal menyimpan metadata foto." };
    }

    // Auto-cover: only if the event has no cover yet (mirrors existing behavior).
    if (!event.cover_image) {
      const { error: coverError } = await supabase
        .from("events")
        .update({ cover_image: storagePath })
        .eq("id", eventId);
      if (coverError) {
        console.warn("[uploadPhotoToB2] gagal set cover otomatis", coverError);
      }
    }

    invalidateAll();
    return { ok: true, message: "Foto berhasil diunggah ke B2." };
  } catch {
    return { ok: false, message: "Gagal mengunggah foto ke B2." };
  }
}

export async function deleteEvent(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const supabase = await requireAdminClient();

    const id = readString(formData, "id");
    if (!id) return { ok: false, message: "ID event tidak valid." };

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event)
      return { ok: false, message: "Event tidak ditemukan." };

    // Collect photo storage_paths for this event.
    const { data: photos, error: photosError } = await supabase
      .from("photos")
      .select("storage_path")
      .eq("event_id", id);
    if (photosError) throw photosError;

    const photoPaths = (photos ?? [])
      .map((row) => row.storage_path)
      .filter((p): p is string => typeof p === "string" && p.length > 0);

    // Storage-first: remove blobs before deleting rows. If Storage fails we
    // abort and leave the database intact (avoids broken public gallery images).
    if (photoPaths.length > 0) {
      const cleanup = await removePhotoObjectsHybrid(supabase, photoPaths);
      if (!cleanup.ok) {
        console.error(
          "[deleteEvent] storage cleanup failed; aborting",
          { eventId: id, failedCount: cleanup.failed.length }
        );
        return {
          ok: false,
          message:
            "Gagal menghapus file foto dari storage. Penghapusan event dibatalkan agar data tidak rusak. Coba lagi.",
        };
      }
    }

    // FK CASCADE handles photos rows.
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) throw error;

    invalidateAll();
    return { ok: true, message: "Event berhasil dihapus." };
  } catch (error) {
    return toActionState(error, "Gagal menghapus event.");
  }
}

export async function revalidatePublicPages(): Promise<void> {
  await requireAdminClient();
  revalidatePath("/", "layout");
}

export type DeletePhotoResult = { ok: boolean; message: string };

export async function deletePhotoById(
  photoId: string,
  eventId: string
): Promise<DeletePhotoResult> {
  try {
    const supabase = await requireAdminClient();

    if (!photoId || !eventId)
      return { ok: false, message: "Parameter tidak valid." };

    const { data: photo, error: photoError } = await supabase
      .from("photos")
      .select("id, storage_path")
      .eq("id", photoId)
      .eq("event_id", eventId)
      .maybeSingle();
    if (photoError) throw photoError;
    if (!photo)
      return {
        ok: false,
        message: "Foto tidak ditemukan pada event yang dikelola.",
      };

    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select("cover_image")
      .eq("id", eventId)
      .maybeSingle();
    if (eventError) throw eventError;

    const sp = photo.storage_path;

    if (isB2Path(sp)) {
      // B2 object: delete via the adapter (credentials stay server-side).
      try {
        await deleteObject(stripB2Prefix(sp));
      } catch {
        return {
          ok: false,
          message:
            "Gagal menghapus file dari storage B2. Penghapusan foto dibatalkan.",
        };
      }
    } else {
      const { error: storageError } = await supabase.storage
        .from("photos")
        .remove([sp]);
      if (storageError)
        return {
          ok: false,
          message: `Gagal menghapus file dari storage: ${storageError.message}`,
        };
    }

    const { error: dbError } = await supabase
      .from("photos")
      .delete()
      .eq("id", photoId)
      .eq("event_id", eventId);
    if (dbError)
      return {
        ok: false,
        message: `File storage sudah terhapus, tetapi record database GAGAL dihapus: ${dbError.message}. Data perlu diperiksa.`,
      };

    const { data: remaining, error: remainingError } = await supabase
      .from("photos")
      .select("storage_path")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true })
      .limit(1);
    if (remainingError) throw remainingError;

    const currentCover = eventData?.cover_image ?? null;
    const firstRemaining = remaining?.[0]?.storage_path ?? null;
    const wasCover =
      currentCover !== null &&
      (currentCover === photo.storage_path ||
        currentCover.endsWith(`/${photo.storage_path}`));

    let nextCover: string | null = currentCover;
    if ((remaining?.length ?? 0) === 0) {
      nextCover = null;
    } else if (currentCover === null || wasCover) {
      nextCover = firstRemaining;
    }

    if (nextCover !== currentCover) {
      const { error: coverError } = await supabase
        .from("events")
        .update({ cover_image: nextCover })
        .eq("id", eventId);
      if (coverError) throw coverError;
    }

    invalidateAll();
    return { ok: true, message: "Foto berhasil dihapus." };
  } catch (error) {
    console.error("[deletePhotoById]", error);
    return { ok: false, message: "Terjadi kesalahan saat menghapus foto." };
  }
}
