import Link from "next/link";
import type { Dict, Lang } from "@/lib/i18n/dictionaries";
import { formatDate, formatMoney } from "@/lib/format";
import type { EnteredOrder, Order } from "@/lib/types";
import { StatusBadge } from "@/components/ui";

/** Orders with money columns: table on wide screens, cards on phones. */
export function OrdersList({
  orders,
  t,
  lang,
  showDesigner,
}: {
  orders: Order[];
  t: Dict;
  lang: Lang;
  showDesigner: boolean;
}) {
  return (
    <>
      <div className="card hidden overflow-x-auto md:block">
        <table className="table">
          <thead>
            <tr>
              <th>{t.fields.orderNumber}</th>
              <th>{t.fields.orderDate}</th>
              <th>{t.fields.client}</th>
              {showDesigner && <th>{t.fields.designer}</th>}
              <th>{t.fields.status}</th>
              <th className="num">{t.fields.totalCost}</th>
              <th className="num">{t.fields.amountPaid}</th>
              <th className="num">{t.fields.remaining}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-canvas">
                <td>
                  <Link href={`/orders/${o.id}`} className="font-semibold text-accent hover:underline">
                    {o.order_number}
                  </Link>
                </td>
                <td className="whitespace-nowrap">{formatDate(o.order_date, lang)}</td>
                <td>
                  <Link href={`/orders/${o.id}`} className="hover:underline">
                    {o.client_name}
                  </Link>
                  {o.client_phone && <span className="block text-sm text-muted">{o.client_phone}</span>}
                </td>
                {showDesigner && (
                  <td className={o.designer ? "" : "text-muted"}>{o.designer?.full_name ?? t.orders.unassigned}</td>
                )}
                <td>
                  <StatusBadge status={o.status} t={t} />
                </td>
                <td className="num">{formatMoney(o.total_cost, lang)}</td>
                <td className="num">{formatMoney(o.amount_paid, lang)}</td>
                <td className={`num font-semibold ${Number(o.remaining_balance) > 0 ? "text-danger" : "text-muted"}`}>
                  {formatMoney(o.remaining_balance, lang)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/orders/${o.id}`} className="card block p-4 active:bg-canvas">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{o.client_name}</p>
                  <p className="text-sm text-muted">
                    № {o.order_number} · {formatDate(o.order_date, lang)}
                    {showDesigner && ` · ${o.designer?.full_name ?? t.orders.unassigned}`}
                  </p>
                </div>
                <StatusBadge status={o.status} t={t} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-muted">{t.fields.totalCost}</p>
                  <p className="tabular-nums">{formatMoney(o.total_cost, lang)}</p>
                </div>
                <div>
                  <p className="text-muted">{t.fields.amountPaid}</p>
                  <p className="tabular-nums">{formatMoney(o.amount_paid, lang)}</p>
                </div>
                <div>
                  <p className="text-muted">{t.fields.remaining}</p>
                  <p className={`font-semibold tabular-nums ${Number(o.remaining_balance) > 0 ? "text-danger" : ""}`}>
                    {formatMoney(o.remaining_balance, lang)}
                  </p>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Call-center view: contact details and who took the order, no money. */
export function EnteredOrdersList({ orders, t, lang }: { orders: EnteredOrder[]; t: Dict; lang: Lang }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {orders.map((o) => (
        <li key={o.id} className="card p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Link href={`/orders/${o.id}`} className="font-semibold hover:underline">
                {o.client_name}
              </Link>
              <p className="text-sm text-muted">
                № {o.order_number} · {formatDate(o.order_date, lang)}
              </p>
            </div>
            <StatusBadge status={o.status} t={t} />
          </div>
          <p className="mt-2 text-sm">
            {[o.client_phone, o.client_address].filter(Boolean).join(" · ") || "—"}
          </p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className={`text-sm ${o.designer_name ? "" : "text-warn"}`}>
              {o.designer_name ? `${t.fields.designer}: ${o.designer_name}` : t.orders.waiting}
            </p>
            {o.editable && (
              <Link href={`/orders/${o.id}/edit`} className="btn btn-secondary btn-sm">
                {t.common.edit}
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
