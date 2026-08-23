"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkUserAdmin } from "@/lib/is-admin";

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

    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id")
      .eq("archive_id", id);
    if (eventsError) throw eventsError;

    const eventIds = (events ?? []).map((row) => row.id);
    let photoCount = 0;

    if (eventIds.length > 0) {
      const { count, error: photosError } = await supabase
        .from("photos")
        .select("id", { count: "exact", head: true })
        .in("event_id", eventIds);
      if (photosError) throw photosError;
      photoCount = count ?? 0;
    }

    if (photoCount > 0)
      return {
        ok: false,
        message: `Tidak aman menghapus: masih ada ${photoCount} foto pada tahun ini. Hapus foto terlebih dahulu (fitur menyusul).`,
      };

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
    const coverImage = readString(formData, "coverImage");

    if (!archiveId) return { ok: false, message: "Arsip tidak valid." };
    if (!name) return { ok: false, message: "Nama event wajib diisi." };
    if (name.length > 120)
      return { ok: false, message: "Nama event maksimal 120 karakter." };
    if (description.length > 500)
      return { ok: false, message: "Deskripsi maksimal 500 karakter." };
    if (coverImage.length > 500)
      return { ok: false, message: "URL cover maksimal 500 karakter." };

    const { error } = await supabase.from("events").insert({
      archive_id: archiveId,
      name,
      description: description || null,
      cover_image: coverImage || null,
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
    const coverImage = readString(formData, "coverImage");

    if (!id) return { ok: false, message: "ID event tidak valid." };
    if (!name) return { ok: false, message: "Nama event wajib diisi." };
    if (name.length > 120)
      return { ok: false, message: "Nama event maksimal 120 karakter." };
    if (description.length > 500)
      return { ok: false, message: "Deskripsi maksimal 500 karakter." };
    if (coverImage.length > 500)
      return { ok: false, message: "URL cover maksimal 500 karakter." };

    const { error } = await supabase
      .from("events")
      .update({
        name,
        description: description || null,
        cover_image: coverImage || null,
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

export async function deleteEvent(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const supabase = await requireAdminClient();

    const id = readString(formData, "id");
    if (!id) return { ok: false, message: "ID event tidak valid." };

    const { count, error: photosError } = await supabase
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("event_id", id);
    if (photosError) throw photosError;

    if ((count ?? 0) > 0)
      return {
        ok: false,
        message: `Tidak aman menghapus: event ini masih memiliki ${count} foto. Hapus foto terlebih dahulu (fitur menyusul).`,
      };

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

    const { error: storageError } = await supabase.storage
      .from("photos")
      .remove([photo.storage_path]);
    if (storageError)
      return {
        ok: false,
        message: `Gagal menghapus file dari storage: ${storageError.message}`,
      };

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
