"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useFormState, useFormStatus } from "react-dom";
import { usePhotoUrl } from "@/lib/use-photo-url";
import { saveHeroSettings } from "@/app/admin/(panel)/archives/actions";

type PickerPhoto = {
  id: string;
  storagePath: string;
  filename: string;
  caption: string | null;
};

type Slot = {
  key: "heroPhoto1Id" | "heroPhoto2Id" | "heroPhoto3Id";
  label: string;
};

const SLOTS: Slot[] = [
  { key: "heroPhoto1Id", label: "Foto Hero 1" },
  { key: "heroPhoto2Id", label: "Foto Hero 2" },
  { key: "heroPhoto3Id", label: "Foto Hero 3" },
];

function Thumb({ storagePath, photoId, alt }: { storagePath: string; photoId?: string; alt: string }) {
  const url = usePhotoUrl({ id: photoId, storagePath });
  if (!url) return <div className="absolute inset-0 animate-pulse bg-cloudgray" />;
  return (
    <Image src={url} alt={alt} fill sizes="160px" className="object-cover" />
  );
}

function SlotPicker({
  slot,
  selected,
  photos,
  onPick,
  onClear,
}: {
  slot: Slot;
  selected: PickerPhoto | null;
  photos: PickerPhoto[];
  onPick: (slotKey: Slot["key"], photo: PickerPhoto) => void;
  onClear: (slotKey: Slot["key"]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-cloudgray bg-white p-4 shadow-sm">
      <p className="mb-2 text-sm font-semibold text-navy-900">{slot.label}</p>

      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-cloudgray ring-1 ring-black/10">
          {selected ? (
            <Thumb storagePath={selected.storagePath} photoId={selected.id} alt={selected.filename || slot.label} />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-charcoal/60">
            {selected ? selected.filename || selected.id : "Belum dipilih"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-navy-900/20 px-3 py-1.5 text-xs font-medium text-navy-900 transition-colors hover:bg-navy-900/5"
          >
            {selected ? "Ganti" : "Pilih Foto"}
          </button>
          {selected ? (
            <button
              type="button"
              onClick={() => onClear(slot.key)}
              className="rounded-lg border border-flagred-500/40 px-3 py-1.5 text-xs font-medium text-flagred-600 transition-colors hover:bg-flagred-500/10"
            >
              Hapus pilihan
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-cloudgray bg-offwhite p-2">
          {photos.length === 0 ? (
            <p className="p-3 text-center text-xs text-charcoal/55">Belum ada foto.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {photos.map((photo) => {
                const isSelected = selected?.id === photo.id;
                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => {
                      onPick(slot.key, photo);
                      setOpen(false);
                    }}
                    aria-pressed={isSelected}
                    aria-label={`Pilih ${photo.filename || "foto"} untuk ${slot.label}`}
                    className={`relative aspect-square overflow-hidden rounded-md ring-2 transition ${
                      isSelected
                        ? "ring-gold-500"
                        : "ring-black/10 hover:ring-navy-600/40"
                    }`}
                  >
                    <Thumb storagePath={photo.storagePath} photoId={photo.id} alt={photo.filename || "Foto"} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-navy-900 px-5 py-2.5 text-sm font-semibold text-offwhite transition-colors hover:bg-navy-800 disabled:opacity-60"
    >
      {pending ? "Menyimpan…" : "Simpan Pengaturan Hero"}
    </button>
  );
}

export function HeroSettingsForm({
  initial,
  photos,
}: {
  initial: { heroPhoto1Id: string | null; heroPhoto2Id: string | null; heroPhoto3Id: string | null };
  photos: PickerPhoto[];
}) {
  const router = useRouter();
  const [selections, setSelections] = useState<Record<string, PickerPhoto | null>>({
    heroPhoto1Id: photos.find((p) => p.id === initial.heroPhoto1Id) ?? null,
    heroPhoto2Id: photos.find((p) => p.id === initial.heroPhoto2Id) ?? null,
    heroPhoto3Id: photos.find((p) => p.id === initial.heroPhoto3Id) ?? null,
  });

  const onPick = useCallback((key: string, photo: PickerPhoto) => {
    setSelections((prev) => ({ ...prev, [key]: photo }));
  }, []);
  const onClear = useCallback((key: string) => {
    setSelections((prev) => ({ ...prev, [key]: null }));
  }, []);

  const [state, formAction] = useFormState(saveHeroSettings, null);

  const onSubmit = useCallback(
    (formData: FormData) => {
      for (const slot of SLOTS) {
        const photo = selections[slot.key];
        formData.set(slot.key, photo?.id ?? "");
      }
      formAction(formData);
    },
    [selections, formAction]
  );

  return (
    <form action={onSubmit} className="space-y-5">
      <p className="text-xs uppercase tracking-[0.18em] text-charcoal/50">
        Hero Homepage
      </p>

      <div className="grid gap-4">
        {SLOTS.map((slot) => (
          <SlotPicker
            key={slot.key}
            slot={slot}
            selected={selections[slot.key]}
            photos={photos}
            onPick={onPick}
            onClear={onClear}
          />
        ))}
      </div>

      {state ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={`rounded-md px-3 py-2 text-sm ${
            state.ok
              ? "bg-emerald-50 text-emerald-700"
              : "bg-flagred-500/10 text-flagred-600"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <SubmitButton />
        <button
          type="button"
          onClick={() => router.refresh()}
          className="rounded-lg border border-navy-900/20 px-4 py-2.5 text-sm font-medium text-navy-900 transition-colors hover:bg-navy-900/5"
        >
          Muat ulang
        </button>
      </div>

      {/* Hidden inputs carry the chosen photo IDs; no storage_path leaves the client. */}
      {SLOTS.map((slot) => (
        <input key={slot.key} type="hidden" name={slot.key} value={selections[slot.key]?.id ?? ""} />
      ))}
    </form>
  );
}
