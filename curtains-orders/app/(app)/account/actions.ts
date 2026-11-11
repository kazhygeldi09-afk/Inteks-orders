"use server";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import type { FormState } from "@/lib/errors";

export async function changePassword(fd: FormData): Promise<FormState> {
  await requireProfile();
  const { t } = await getI18n();
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: t.errors.PASSWORD_SHORT };
  if (password !== String(fd.get("confirm") ?? "")) return { error: t.errors.PASSWORD_MISMATCH };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("updateUser failed:", error.message);
    return { error: t.errors.GENERIC };
  }
  return { ok: true };
}
