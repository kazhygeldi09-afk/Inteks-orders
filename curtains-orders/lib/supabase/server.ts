import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.local.example to .env.local and fill it in.",
    );
  }
  return { url, key };
}

/** Supabase client acting as the signed-in user (database rules apply). */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component: cookies are read-only there.
          // proxy.ts refreshes the session, so this can be ignored.
        }
      },
    },
  });
}

/**
 * Supabase client with the secret key. It skips all database rules, so use
 * it only on the server, only after checking the caller is a manager/owner.
 */
export function createAdminClient() {
  const { url } = supabaseEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new Error("Missing SUPABASE_SECRET_KEY in the server environment.");
  }
  return createPlainClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
