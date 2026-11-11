"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import type { FormState } from "@/lib/errors";

export async function signIn(formData: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: t.login.invalid };

  redirect("/orders");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
