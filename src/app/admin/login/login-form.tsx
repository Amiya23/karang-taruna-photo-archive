"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { checkUserAdmin } from "@/lib/is-admin";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      {
        email,
        password,
      }
    );

    if (signInError) {
      setError("Email atau kata sandi salah.");
      setLoading(false);
      return;
    }

    if (!data.user || !data.session) {
      setError("Sesi tidak valid setelah login. Silakan coba lagi.");
      setLoading(false);
      return;
    }

    const result = await checkUserAdmin(supabase, data.user.id);

    if (result.status === "error") {
      setError(
        `Verifikasi admin gagal (${result.message}). Periksa koneksi lalu coba lagi.`
      );
      setLoading(false);
      return;
    }

    if (result.status === "not_admin") {
      await supabase.auth.signOut();
      setError("Akun ini tidak memiliki akses admin.");
      setLoading(false);
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-charcoal"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={loading}
          className="w-full rounded-md border border-cloudgray bg-white px-3 py-2 text-charcoal outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/20 disabled:opacity-60"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-sm font-medium text-charcoal"
        >
          Kata sandi
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={loading}
          className="w-full rounded-md border border-cloudgray bg-white px-3 py-2 text-charcoal outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/20 disabled:opacity-60"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-flagred-500/10 px-3 py-2 text-sm text-flagred-600">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 w-full rounded-md bg-navy-900 px-4 py-2.5 font-medium text-offwhite transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Memproses..." : "Masuk"}
      </button>
    </form>
  );
}
