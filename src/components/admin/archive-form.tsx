"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/admin/(panel)/archives/actions";

type ArchiveFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: {
    id: string;
    year: number;
    title: string;
    description: string | null;
    coverImage: string | null;
  };
  submitLabel: string;
};

const inputClass =
  "w-full rounded-md border border-cloudgray bg-white px-3 py-2 text-sm text-charcoal outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/20";

export function ArchiveForm({
  action,
  initial,
  submitLabel,
}: ArchiveFormProps) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="grid gap-3">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-charcoal">Tahun</span>
          <input
            type="number"
            name="year"
            min={1900}
            max={2999}
            required
            defaultValue={initial?.year}
            placeholder="2026"
            className={inputClass}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-charcoal">Judul</span>
          <input
            type="text"
            name="title"
            required
            maxLength={200}
            defaultValue={initial?.title}
            placeholder="HUT RI ke-81 — Dokumentasi Karang Taruna"
            className={inputClass}
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-charcoal">
          Deskripsi (opsional)
        </span>
        <textarea
          name="description"
          rows={2}
          maxLength={1000}
          defaultValue={initial?.description ?? ""}
          className={inputClass}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-charcoal">
          Cover Image URL (opsional)
        </span>
        <input
          type="text"
          name="coverImage"
          maxLength={500}
          defaultValue={initial?.coverImage ?? ""}
          placeholder="https://… atau path storage"
          className={inputClass}
        />
      </label>

      {state ? (
        <p
          role="alert"
          className={`rounded-md px-3 py-2 text-sm ${
            state.ok
              ? "bg-emerald-50 text-emerald-700"
              : "bg-flagred-500/10 text-flagred-600"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-offwhite transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Menyimpan..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
