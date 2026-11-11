import type { Dict, Lang } from "@/lib/i18n/dictionaries";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { OrderChange, OrderStatus, PaymentMethod } from "@/lib/types";

const FIELD_LABEL: Record<string, keyof Dict["fields"]> = {
  client_name: "clientName",
  client_phone: "phone",
  client_address: "address",
  order_date: "orderDate",
  product_details: "productDetails",
  notes: "notes",
  total_cost: "totalCost",
  status: "status",
  designer_id: "designer",
  source: "source",
};

export function History({
  changes,
  t,
  lang,
  names,
}: {
  changes: OrderChange[];
  t: Dict;
  lang: Lang;
  /** profile id → name, for showing designer changes */
  names: Record<string, string>;
}) {
  const show = (field: string, value: unknown): string => {
    if (value === null || value === undefined || value === "") return "—";
    if (field === "total_cost") return formatMoney(value as number, lang);
    if (field === "status") return t.statuses[value as OrderStatus] ?? String(value);
    if (field === "source") return t.sources[value as "designer" | "online"] ?? String(value);
    if (field === "order_date") return formatDate(String(value), lang);
    if (field === "designer_id") return names[String(value)] ?? "…";
    return String(value);
  };

  return (
    <ol className="space-y-3">
      {changes.map((c) => (
        <li key={c.id} className="border-l-2 border-line pl-3">
          <p className="text-sm">
            <span className="font-semibold">{t.history[c.action]}</span>
            <span className="text-muted">
              {" · "}
              {c.changed_by_name || "—"} · {formatDateTime(c.changed_at, lang)}
            </span>
          </p>
          {c.action === "updated" && (
            <ul className="mt-1 space-y-0.5 text-sm">
              {Object.entries(c.changes).map(([field, v]) => {
                const { old: before, new: after } = v as { old: unknown; new: unknown };
                return (
                  <li key={field}>
                    <span className="text-muted">{t.fields[FIELD_LABEL[field]] ?? field}: </span>
                    <span className="line-through decoration-muted/60">{show(field, before)}</span>
                    {" → "}
                    <span>{show(field, after)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {(c.action === "payment_added" || c.action === "payment_deleted") && (
            <p className="mt-1 text-sm">
              {formatMoney(c.changes.amount as number, lang)} ·{" "}
              {t.methods[c.changes.method as PaymentMethod]} · {formatDate(String(c.changes.paid_on), lang)}
            </p>
          )}
          {c.reason && (
            <p className="mt-1 text-sm">
              <span className="text-muted">{t.history.reason}: </span>
              {c.reason}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
