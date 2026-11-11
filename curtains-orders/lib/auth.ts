import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";

/** The signed-in user's profile, or null when signed out. Once per request. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, active")
    .eq("id", userId)
    .maybeSingle();
  return (profile as Profile | null) ?? null;
});

/**
 * Page/action guard. Sends signed-out users to /login, and users without an
 * active role (or without one of `roles`) to /no-access.
 */
export async function requireProfile(roles?: Role[]) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.active || !profile.role) redirect("/no-access");
  if (roles && !roles.includes(profile.role)) redirect("/no-access");
  return profile as Profile & { role: Role };
}
