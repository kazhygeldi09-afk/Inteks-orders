import { isUuid } from "@/lib/queries";
import { STATUSES, type OrderStatus } from "@/lib/types";

export type OrderFilters = {
  q: string;
  designer: string; // "" | "none" | designer id
  status: OrderStatus | "";
  unpaid: boolean;
};

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function readFilters(params: Params): OrderFilters {
  const designer = first(params.designer);
  const status = first(params.status);
  return {
    q: first(params.q).trim().slice(0, 100),
    designer: designer === "none" || isUuid(designer) ? designer : "",
    status: (STATUSES as readonly string[]).includes(status) ? (status as OrderStatus) : "",
    unpaid: first(params.unpaid) === "1",
  };
}

export function filtersToQuery(f: OrderFilters) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.designer) p.set("designer", f.designer);
  if (f.status) p.set("status", f.status);
  if (f.unpaid) p.set("unpaid", "1");
  return p.toString();
}

// Minimal shape of a Supabase select query, so filters can be reused.
type Filterable<Q> = {
  eq(column: string, value: unknown): Q;
  neq(column: string, value: unknown): Q;
  is(column: string, value: null): Q;
  gt(column: string, value: unknown): Q;
  or(filters: string): Q;
};

export function applyFilters<Q extends Filterable<Q>>(query: Q, f: OrderFilters): Q {
  let q = query;
  if (f.designer === "none") q = q.is("designer_id", null);
  else if (f.designer) q = q.eq("designer_id", f.designer);
  if (f.status) q = q.eq("status", f.status);
  if (f.unpaid) q = q.gt("remaining_balance", 0).neq("status", "cancelled");
  if (f.q) {
    // Characters with special meaning in PostgREST filters are dropped.
    const term = f.q.replace(/[,()*%\\:"]/g, " ").trim();
    if (term) {
      const parts = [
        `client_name.ilike.*${term}*`,
        `client_phone.ilike.*${term}*`,
        `client_address.ilike.*${term}*`,
      ];
      if (/^\d{1,12}$/.test(term)) parts.push(`order_number.eq.${term}`);
      q = q.or(parts.join(","));
    }
  }
  return q;
}
