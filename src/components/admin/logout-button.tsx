"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="rounded-md border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-offwhite transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Mengeluarkan..." : "Keluar"}
    </button>
  );
}
