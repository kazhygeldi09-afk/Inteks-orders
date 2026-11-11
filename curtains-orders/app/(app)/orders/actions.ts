"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { errorCode, type FormState } from "@/lib/errors";
import { parseMoney } from "@/lib/format";
import { isManager, METHODS, STATUSES, type Role } from "@/lib/types";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const oneOf = <T extends string>(value: string, allowed: readonly T[]) =>
  (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

/** Which order fields each role may set when editing. Mirrors update_order(). */
const EDITABLE: Record<Role, string[]> = {
  manager: ["client_name", "client_phone", "client_address", "order_date", "product_details", "notes", "total_cost", "status", "designer_id", "source"],
  owner: ["client_name", "client_phone", "client_address", "order_date", "product_details", "notes", "total_cost", "status", "designer_id", "source"],
  designer: ["client_name", "client_phone", "client_address", "order_date", "product_details", "notes", "total_cost", "status"],
  call_center: ["client_name", "client_phone", "client_address", "product_details", "notes"],
};

/** Reads the posted form into the shape create_order / update_order expect. */
function readOrderForm(fd: FormData, fields: string[]): Record<string, unknown> | "INVALID_AMOUNT" {
  const data: Record<string, unknown> = {};
  for (const f of fields) {
    if (!fd.has(f)) continue;
    const value = text(fd, f);
    if (f === "total_cost") {
      const n = parseMoney(value);
      if (Number.isNaN(n)) return "INVALID_AMOUNT";
      data[f] = n ?? 0;
    } else if (f === "designer_id") {
      data[f] = value || null;
    } else if (f === "status") {
      data[f] = oneOf(value, STATUSES) ?? "new";
    } else if (f === "source") {
      data[f] = value === "online" ? "online" : "designer";
    } else if (f === "order_date") {
      if (value) data[f] = value;
    } else {
      data[f] = value;
    }
  }
  return data;
}

export async function createOrder(fd: FormData): Promise<FormState> {
  const profile = await requireProfile();
  const { t } = await getI18n();

  const fields = isManager(profile.role)
    ? EDITABLE.manager
    : profile.role === "designer"
      ? EDITABLE.designer
      : EDITABLE.call_center;
  const data = readOrderForm(fd, fields);
  if (data === "INVALID_AMOUNT") return { error: t.errors.INVALID_AMOUNT };

  if (profile.role !== "call_center") {
    const deposit = parseMoney(fd.get("deposit"));
    if (Number.isNaN(deposit)) return { error: t.errors.INVALID_AMOUNT };
    data.deposit = deposit ?? 0;
    data.deposit_method = oneOf(text(fd, "deposit_method"), METHODS) ?? "cash";
  }

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_order", { p_data: data });
  if (error) return { error: t.errors[errorCode(error)] };

  revalidatePath("/orders");
  redirect(profile.role === "call_center" ? "/orders?created=1" : `/orders/${id}`);
}

export async function updateOrder(orderId: string, fd: FormData): Promise<FormState> {
  const profile = await requireProfile();
  const { t } = await getI18n();

  const data = readOrderForm(fd, EDITABLE[profile.role]);
  if (data === "INVALID_AMOUNT") return { error: t.errors.INVALID_AMOUNT };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_order", {
    p_order_id: orderId,
    p_data: data,
    p_reason: text(fd, "reason"),
  });
  if (error) return { error: t.errors[errorCode(error)] };

  revalidatePath("/orders");
  redirect(profile.role === "call_center" ? "/orders" : `/orders/${orderId}`);
}

export async function takeOrder(orderId: string) {
  await requireProfile(["designer"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("take_order", { p_order_id: orderId });
  revalidatePath("/orders");
  if (error) redirect(`/orders?error=${errorCode(error)}`);
  redirect(`/orders/${orderId}`);
}

export async function deleteOrder(orderId: string) {
  await requireProfile(["manager", "owner"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_order", { p_order_id: orderId });
  revalidatePath("/orders");
  if (error) redirect(`/orders/${orderId}?error=${errorCode(error)}`);
  redirect("/orders");
}

export async function addPayment(orderId: string, fd: FormData): Promise<FormState> {
  await requireProfile(["designer", "manager", "owner"]);
  const { t } = await getI18n();

  const amount = parseMoney(fd.get("amount"));
  if (amount === null || Number.isNaN(amount) || amount <= 0) {
    return { error: t.errors.INVALID_AMOUNT };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_payment", {
    p_order_id: orderId,
    p_amount: amount,
    p_paid_on: text(fd, "paid_on") || undefined,
    p_method: oneOf(text(fd, "method"), METHODS) ?? "cash",
    p_note: text(fd, "note"),
  });
  if (error) return { error: t.errors[errorCode(error)] };

  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

export async function deletePayment(paymentId: string, orderId: string, fd: FormData): Promise<FormState> {
  await requireProfile(["designer", "manager", "owner"]);
  const { t } = await getI18n();

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_payment", {
    p_payment_id: paymentId,
    p_reason: text(fd, "reason"),
  });
  if (error) return { error: t.errors[errorCode(error)] };

  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}
