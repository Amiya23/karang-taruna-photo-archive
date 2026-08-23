import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminCheckResult =
  | { status: "admin" }
  | { status: "not_admin" }
  | { status: "error"; message: string };

export async function checkUserAdmin(
  client: SupabaseClient,
  userId: string
): Promise<AdminCheckResult> {
  const { data, error } = await client
    .from("admin_profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    const detail = [error.code, error.message].filter(Boolean).join(": ");
    return {
      status: "error",
      message: detail || "Query admin_profiles gagal tanpa pesan.",
    };
  }

  return data !== null ? { status: "admin" } : { status: "not_admin" };
}
