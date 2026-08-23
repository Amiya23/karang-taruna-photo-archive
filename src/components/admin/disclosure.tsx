"use client";

import { useState } from "react";

export function Disclosure({
  label,
  children,
  variant = "secondary",
}: {
  label: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const [open, setOpen] = useState(false);

  const variantClass =
    variant === "primary"
      ? "bg-navy-900 text-offwhite hover:bg-navy-800"
      : variant === "ghost"
        ? "border border-cloudgray bg-white text-charcoal hover:border-navy-600"
        : "border border-cloudgray bg-white text-navy-900 hover:border-navy-600";

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${variantClass}`}
      >
        {open ? "Tutup" : label}
      </button>

      {open ? (
        <div className="mt-3 rounded-xl border border-cloudgray bg-white p-4 shadow-sm">
          {children}
        </div>
      ) : null}
    </div>
  );
}
