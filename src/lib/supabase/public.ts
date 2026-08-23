import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

export function createPublicClient() {
  const { url, publishableKey } = getSupabaseEnv();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
  });
}
