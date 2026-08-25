import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkUserAdmin } from "@/lib/is-admin";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Login Admin — Arsip 17 Agustus",
};

export default async function AdminLoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const adminCheck = await checkUserAdmin(supabase, user.id);
    if (adminCheck.status === "admin") {
      redirect("/admin");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-navy-900">Login Admin</h1>
        <p className="mt-2 text-sm text-charcoal/70">
          Area khusus pengelola Arsip Dokumentasi 17 Agustus Karang Taruna RT016.
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
