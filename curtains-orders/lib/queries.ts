import { createClient } from "@/lib/supabase/server";
import type { EnteredOrder, Order } from "@/lib/types";

/** Active designers, for managers' dropdowns. Empty for everyone else. */
export async function listDesigners() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "designer")
    .eq("active", true)
    .order("full_name");
  return (data ?? []) as { id: string; full_name: string }[];
}

/** One order as a designer or manager sees it (null if not visible). */
export async function getOrder(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*, designer:profiles!orders_designer_id_fkey(full_name)")
    .eq("id", id)
    .maybeSingle();
  return data as Order | null;
}

/** One order as the call-center person who entered it sees it. */
export async function getEnteredOrder(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_entered_orders").eq("id", id).maybeSingle();
  return data as EnteredOrder | null;
}

export const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
