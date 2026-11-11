"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import type { FormState } from "@/lib/errors";
import { ROLES, type Role } from "@/lib/types";

// These actions use the secret key (no database rules apply), so every
// permission check happens here, before anything is changed.

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const asRole = (v: string) => ((ROLES as readonly string[]).includes(v) ? (v as Role) : null);

export async function createStaff(fd: FormData): Promise<FormState> {
  const me = await requireProfile(["manager", "owner"]);
  const { t } = await getI18n();

  const email = text(fd, "email").toLowerCase();
  const fullName = text(fd, "full_name");
  const role = asRole(text(fd, "role"));
  const password = String(fd.get("password") ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: t.errors.INVALID_EMAIL };
  if (!fullName) return { error: t.errors.NAME_REQUIRED };
  if (!role) return { error: t.errors.GENERIC };
  if (role === "owner" && me.role !== "owner") return { error: t.errors.OWNER_ONLY };
  if (password.length < 8) return { error: t.errors.PASSWORD_SHORT };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role, full_name: fullName },
  });
  if (error) {
    if (/already|exists|registered/i.test(error.message)) return { error: t.errors.EMAIL_TAKEN };
    console.error("createUser failed:", error.message);
    return { error: t.errors.GENERIC };
  }

  revalidatePath("/staff");
  return { ok: true };
}

export async function updateStaff(userId: string, fd: FormData): Promise<FormState> {
  const me = await requireProfile(["manager", "owner"]);
  const { t } = await getI18n();
  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("id, role, active")
    .eq("id", userId)
    .maybeSingle();
  if (!target) return { error: t.errors.NOT_FOUND };

  const fullName = text(fd, "full_name");
  const role = asRole(text(fd, "role"));
  const active = fd.get("active") === "on";
  if (!fullName) return { error: t.errors.NAME_REQUIRED };
  if (!role) return { error: t.errors.GENERIC };

  if (userId === me.id && (role !== me.role || !active)) return { error: t.errors.NOT_YOURSELF };
  if ((target.role === "owner" || role === "owner") && me.role !== "owner") {
    return { error: t.errors.OWNER_ONLY };
  }

  const { error } = await admin
    .from("profiles")
    .update({ full_name: fullName, role, active })
    .eq("id", userId);
  if (error) return { error: t.errors.GENERIC };

  if (active !== target.active) {
    // Disabled staff are also blocked from signing in.
    await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
  }

  revalidatePath("/staff");
  return { ok: true };
}

export async function setStaffPassword(userId: string, fd: FormData): Promise<FormState> {
  const me = await requireProfile(["manager", "owner"]);
  const { t } = await getI18n();
  const admin = createAdminClient();

  const { data: target } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!target) return { error: t.errors.NOT_FOUND };
  if (target.role === "owner" && me.role !== "owner") return { error: t.errors.OWNER_ONLY };

  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: t.errors.PASSWORD_SHORT };

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { error: t.errors.GENERIC };
  return { ok: true };
}
