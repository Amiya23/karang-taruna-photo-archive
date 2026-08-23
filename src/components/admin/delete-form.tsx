"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/admin/(panel)/archives/actions";

export function DeleteForm({
  action,
  id,
  confirmMessage,
  label = "Hapus",
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  id: string;
  confirmMessage: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <div className="flex flex-col items-start gap-1">
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          disabled={pending}
          onClick={(event) => {
            if (!window.confirm(confirmMessage)) event.preventDefault();
          }}
          className="rounded-lg border border-flagred-500/40 bg-white px-3.5 py-2 text-sm font-medium text-flagred-600 transition-colors hover:bg-flagred-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Menghapus..." : label}
        </button>
      </form>

      {state && !state.ok ? (
        <p role="alert" className="max-w-xs text-xs text-flagred-600">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
