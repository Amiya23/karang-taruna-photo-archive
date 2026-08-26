"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { revalidatePublicPages, uploadPhotoToB2, uploadPhotoToR2 } from "@/app/admin/(panel)/archives/actions";

type UploadStatus = "queued" | "uploading" | "success" | "failed";

type QueueItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  progress: number;
  error?: string;
};

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE = 10 * 1024 * 1024;
const CONCURRENCY = 3;

function sanitizeFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const rawExt = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  const ext = /^\.(jpe?g|png|webp)$/.test(rawExt) ? rawExt : "";
  const base = (dot >= 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "foto"}${ext}`;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function uploadWithProgress(
  url: string,
  file: File,
  token: string,
  publishableKey: string,
  onProgress: (fraction: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", publishableKey);
    xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage menolak (HTTP ${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Koneksi ke storage gagal"));
    xhr.send(file);
  });
}

const statusChipClass: Record<UploadStatus, string> = {
  queued: "border-cloudgray bg-offwhite text-charcoal/60",
  uploading: "border-gold-500/40 bg-gold-500/10 text-gold-600",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-flagred-500/30 bg-flagred-500/10 text-flagred-600",
};

const statusLabel: Record<UploadStatus, string> = {
  queued: "Menunggu",
  uploading: "Mengunggah",
  success: "Berhasil",
  failed: "Gagal",
};

export function PhotoUploader({
  year,
  eventId,
  eventCover,
  b2Enabled = false,
  r2Enabled = false,
}: {
  year: number;
  eventId: string;
  eventCover: string | null;
  b2Enabled?: boolean;
  r2Enabled?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const runningRef = useRef(false);
  const coverAssignedRef = useRef(false);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [overall, setOverall] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<{ success: number; failed: number } | null>(null);

  const updateItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const next: QueueItem[] = Array.from(files).map((file) => {
      let error: string | undefined;
      if (!ACCEPTED_TYPES.has(file.type))
        error = "Tipe tidak didukung (hanya JPEG/PNG/WebP)";
      else if (file.size > MAX_SIZE) error = "Ukuran melebihi 10 MB";
      else if (file.size === 0) error = "File kosong";

      return {
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: error ? "failed" : "queued",
        progress: 0,
        error,
      };
    });

    setQueue((prev) => [...prev, ...next]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setQueue((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  useEffect(() => {
    return () => {
      setQueue((prev) => {
        prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        return prev;
      });
    };
  }, []);

  const startUpload = useCallback(async () => {
    if (runningRef.current) return;

    const pending = queue.filter((item) => item.status === "queued");
    if (pending.length === 0) return;

    runningRef.current = true;
    setIsUploading(true);
    setSummary(null);
    setOverall({ done: 0, total: pending.length });

    // --- R2 path: NEW uploads routed to Cloudflare R2 via a server action. ---
    // Mirrors the B2 path. R2_UPLOAD_ENABLED gate lives in the server action,
    // so this branch is only taken when the admin page passes r2Enabled=true.
    if (r2Enabled) {
      let successCount = 0;
      let failCount = 0;
      for (const job of pending) {
        updateItem(job.id, { status: "uploading", progress: 0, error: undefined });
        const formData = new FormData();
        formData.append("eventId", eventId);
        formData.append("year", String(year));
        formData.append("file", job.file);
        try {
          const result = await uploadPhotoToR2(
            { ok: false, message: "" },
            formData
          );
          if (result.ok) {
            updateItem(job.id, { status: "success", progress: 100 });
            successCount += 1;
          } else {
            updateItem(job.id, {
              status: "failed",
              error: result.message || "Upload gagal",
            });
            failCount += 1;
          }
        } catch {
          updateItem(job.id, { status: "failed", error: "Upload gagal" });
          failCount += 1;
        }
        setOverall({ done: successCount + failCount, total: pending.length });
      }

      setSummary({ success: successCount, failed: failCount });
      setIsUploading(false);
      runningRef.current = false;
      if (successCount > 0) {
        try {
          await revalidatePublicPages();
        } catch {}
        router.refresh();
      }
      return;
    }

    // --- B2 path: NEW uploads routed to Backblaze B2 via a server action. ---
    // Credentials never reach the browser; the server action uploads the bytes.
    // No native upload progress is available, so we use a truthful "Mengunggah…"
    // state (no fake percentage).
    if (b2Enabled) {
      let successCount = 0;
      let failCount = 0;
      for (const job of pending) {
        updateItem(job.id, { status: "uploading", progress: 0, error: undefined });
        const formData = new FormData();
        formData.append("eventId", eventId);
        formData.append("year", String(year));
        formData.append("file", job.file);
        try {
          const result = await uploadPhotoToB2(
            { ok: false, message: "" },
            formData
          );
          if (result.ok) {
            updateItem(job.id, { status: "success", progress: 100 });
            successCount += 1;
          } else {
            updateItem(job.id, {
              status: "failed",
              error: result.message || "Upload gagal",
            });
            failCount += 1;
          }
        } catch {
          updateItem(job.id, { status: "failed", error: "Upload gagal" });
          failCount += 1;
        }
        setOverall({ done: successCount + failCount, total: pending.length });
      }

      setSummary({ success: successCount, failed: failCount });
      setIsUploading(false);
      runningRef.current = false;
      if (successCount > 0) {
        try {
          await revalidatePublicPages();
        } catch {}
        router.refresh();
      }
      return;
    }

    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      pending.forEach((item) =>
        updateItem(item.id, {
          status: "failed",
          error: "Sesi berakhir. Silakan login ulang.",
        })
      );
      setSummary({ success: 0, failed: pending.length });
      setIsUploading(false);
      runningRef.current = false;
      return;
    }

    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

    let cursor = 0;
    let successCount = 0;
    let failCount = 0;
    const total = pending.length;

    const runJob = async (job: QueueItem) => {
      updateItem(job.id, { status: "uploading", progress: 0, error: undefined });

      const path = `${year}/${eventId}/${Date.now()}-${sanitizeFilename(
        job.file.name
      )}`;
      const url = `${
        process.env.NEXT_PUBLIC_SUPABASE_URL
      }/storage/v1/object/photos/${encodeURI(path)}`;

      try {
        await uploadWithProgress(
          url,
          job.file,
          token,
          publishableKey,
          (fraction) =>
            updateItem(job.id, { progress: Math.round(fraction * 100) })
        );
      } catch (error) {
        updateItem(job.id, {
          status: "failed",
          error: error instanceof Error ? error.message : "Upload gagal",
        });
        return false;
      }

      try {
        const { error } = await supabase.from("photos").insert({
          event_id: eventId,
          storage_path: path,
          filename: job.file.name,
        });
        if (error) throw error;
      } catch {
        try {
          await supabase.storage.from("photos").remove([path]);
        } catch {}
        updateItem(job.id, {
          status: "failed",
          error: "Gagal menyimpan metadata foto",
        });
        return false;
      }

      if (!eventCover && !coverAssignedRef.current) {
        coverAssignedRef.current = true;
        try {
          const { error: coverError } = await supabase
            .from("events")
            .update({ cover_image: path })
            .eq("id", eventId);
          if (coverError) throw coverError;
        } catch (coverAssignError) {
          console.warn(
            "[photo-uploader] Gagal menetapkan cover otomatis:",
            coverAssignError
          );
        }
      }

      updateItem(job.id, { status: "success", progress: 100 });
      return true;
    };

    const worker = async () => {
      while (cursor < pending.length) {
        const job = pending[cursor];
        cursor += 1;
        if (!job) break;

        const ok = await runJob(job);
        if (ok) successCount += 1;
        else failCount += 1;
        setOverall({ done: successCount + failCount, total });
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, pending.length) }, () =>
        worker()
      )
    );

    setSummary({ success: successCount, failed: failCount });
    setIsUploading(false);
    runningRef.current = false;

    if (successCount > 0) {
      try {
        await revalidatePublicPages();
      } catch {}
      router.refresh();
    }
  }, [b2Enabled, r2Enabled, eventId, eventCover, queue, router, updateItem, year]);

  const queuedCount = queue.filter((item) => item.status === "queued").length;
  const overallPercent =
    overall.total > 0 ? Math.round((overall.done / overall.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) {
            dragDepth.current = 0;
            setDragging(false);
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging
            ? "border-gold-500 bg-gold-500/10"
            : "border-cloudgray bg-offwhite hover:border-navy-600/50"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-8 w-8 text-navy-900/40"
          aria-hidden
        >
          <path d="M12 16V6m0 0-3.5 3.5M12 6l3.5 3.5" />
          <path d="M4 17v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1" />
        </svg>
        <p className="text-sm font-medium text-charcoal">
          Tarik &amp; lepas foto di sini
        </p>
        <p className="text-xs text-charcoal/55">
          atau klik untuk memilih • JPEG/PNG/WebP • maksimal 10 MB per file
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {queue.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-charcoal/70">
              {queuedCount} menunggu •{" "}
              {queue.filter((i) => i.status !== "queued").length} diproses
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQueue([])}
                disabled={isUploading}
                className="rounded-lg border border-cloudgray bg-white px-3.5 py-2 text-sm font-medium text-charcoal transition-colors hover:border-navy-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Kosongkan
              </button>
              <button
                type="button"
                onClick={startUpload}
                disabled={isUploading || queuedCount === 0}
                className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-950 transition-colors hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploading
                  ? `Mengunggah ${overall.done}/${overall.total}...`
                  : `Unggah ${queuedCount} Foto`}
              </button>
            </div>
          </div>

          {isUploading || summary ? (
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-cloudgray">
                <div
                  className="h-full rounded-full bg-gold-500 transition-all duration-300"
                  style={{ width: `${overallPercent}%` }}
                />
              </div>
              <p className="text-xs text-charcoal/55">
                Total: {overall.done}/{overall.total} ({overallPercent}%)
              </p>
            </div>
          ) : null}

          {summary ? (
            <p className="rounded-lg px-3 py-2 text-sm">
              <span className="font-medium text-emerald-700">
                Berhasil: {summary.success}
              </span>{" "}
              •{" "}
              <span className="font-medium text-flagred-600">
                Gagal: {summary.failed}
              </span>
            </p>
          ) : null}

          <ul className="space-y-2">
            {queue.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-cloudgray bg-white p-3"
              >
                <Image
                  src={item.previewUrl}
                  alt=""
                  width={56}
                  height={56}
                  unoptimized
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-charcoal">
                    {item.file.name}
                  </p>
                  <p className="text-xs text-charcoal/50">
                    {formatSize(item.file.size)}
                  </p>

                  {item.status === "uploading" ? (
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-cloudgray">
                      <div
                        className="h-full rounded-full bg-gold-500 transition-all duration-200"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  ) : null}

                  {item.status === "failed" && item.error ? (
                    <p className="mt-0.5 text-xs text-flagred-600">
                      {item.error}
                    </p>
                  ) : null}
                </div>

                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] ${statusChipClass[item.status]}`}
                >
                  {statusLabel[item.status]}
                  {item.status === "uploading" ? ` ${item.progress}%` : ""}
                </span>

                {!isUploading && item.status !== "uploading" ? (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label={`Hapus ${item.file.name} dari daftar`}
                    className="shrink-0 rounded-md p-1.5 text-charcoal/40 transition-colors hover:bg-cloudgray hover:text-charcoal"
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
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
