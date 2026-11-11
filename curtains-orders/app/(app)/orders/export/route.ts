import { type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { applyFilters, readFilters } from "@/lib/orderFilters";
import { todayISO } from "@/lib/format";
import { isManager, type Order } from "@/lib/types";

// Managers: download the (filtered) order list as CSV.
// In Google Sheets: File → Import → Upload → choose the file.
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile?.active || !isManager(profile.role)) {
    return new Response("Forbidden", { status: 403 });
  }
  const { t } = await getI18n();

  const filters = readFilters(Object.fromEntries(request.nextUrl.searchParams));
  const supabase = await createClient();
  const rows: Order[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await applyFilters(
      supabase
        .from("orders")
        .select("*, designer:profiles!orders_designer_id_fkey(full_name)")
        .order("order_date", { ascending: false })
        .order("order_number", { ascending: false })
        .range(from, from + PAGE - 1),
      filters,
    );
    if (error) return new Response("Export failed", { status: 500 });
    rows.push(...((data ?? []) as Order[]));
    if (!data || data.length < PAGE) break;
  }

  const header = [
    t.fields.orderNumber,
    t.fields.orderDate,
    t.fields.clientName,
    t.fields.phone,
    t.fields.address,
    t.fields.designer,
    t.fields.source,
    t.fields.status,
    t.fields.totalCost,
    t.fields.amountPaid,
    t.fields.remaining,
    t.fields.productDetails,
    t.fields.notes,
  ];
  const lines = rows.map((o) => [
    o.order_number,
    o.order_date,
    o.client_name,
    o.client_phone,
    o.client_address,
    o.designer?.full_name ?? "",
    t.sources[o.source],
    t.statuses[o.status],
    Number(o.total_cost),
    Number(o.amount_paid),
    Number(o.remaining_balance),
    o.product_details,
    o.notes,
  ]);

  // BOM so Cyrillic and Kazakh letters open correctly everywhere.
  const csv = "﻿" + [header, ...lines].map((r) => r.map(cell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${todayISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function cell(value: string | number) {
  if (typeof value === "number") return String(value);
  let s = value;
  // Text starting with = + - @ would run as a formula in a spreadsheet
  // (phone numbers like "+7 701…" included); a leading ' keeps it as text.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
