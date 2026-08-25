"use client";

import { useActionState, useState } from "react";
import { eventSlug } from "@/lib/slug";
import type { ActionState } from "@/app/admin/(panel)/archives/actions";

type EventFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: {
    id: string;
    name: string;
    description: string | null;
  };
  archiveId?: string;
  submitLabel: string;
};

const inputClass =
  "w-full rounded-md border border-cloudgray bg-white px-3 py-2 text-sm text-charcoal outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/20";

export function EventForm({
  action,
  initial,
  archiveId,
  submitLabel,
}: EventFormProps) {
  const [state, formAction, pending] = useActionState(action, null);
  const [name, setName] = useState(initial?.name ?? "");

  return (
    <form action={formAction} className="grid gap-3">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      {archiveId ? (
        <input type="hidden" name="archiveId" value={archiveId} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-charcoal">
            Nama Event
          </span>
          <input
            type="text"
            name="name"
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Lomba / Karnaval / Tasyakuran / nama lain"
            className={inputClass}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-charcoal">
            Slug (otomatis dari nama)
          </span>
          <input
            type="text"
            readOnly
            value={eventSlug(name)}
            placeholder="slug"
            className={`${inputClass} cursor-not-allowed bg-offwhite text-charcoal/50`}
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
          maxLength={500}
          defaultValue={initial?.description ?? ""}
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
