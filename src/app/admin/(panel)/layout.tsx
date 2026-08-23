import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkUserAdmin } from "@/lib/is-admin";
import { LogoutButton } from "@/components/admin/logout-button";
import { AdminNavLinks } from "@/components/admin/admin-nav-links";

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const adminCheck = await checkUserAdmin(supabase, user.id);
  if (adminCheck.status !== "admin") redirect("/");

  return (
    <div className="flex min-h-screen flex-col bg-offwhite">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-navy-950">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
          <Link href="/admin" className="flex items-center gap-3">
            <Image
              src="/brand/karang-taruna-logo.png"
              alt="Logo Karang Taruna"
              width={40}
              height={40}
              priority
              className="h-9 w-auto"
            />
            <span className="leading-tight">
              <span className="block text-sm font-semibold text-offwhite">
                Panel Admin
              </span>
              <span className="block text-[11px] uppercase tracking-[0.2em] text-gold-300">
                Arsip 17 Agustus
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-3 sm:gap-5">
            <AdminNavLinks />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
