"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/archives", label: "Arsip Tahun" },
];

export function AdminNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {items.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-white/10 text-gold-300"
                : "text-offwhite/70 hover:bg-white/5 hover:text-offwhite"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
