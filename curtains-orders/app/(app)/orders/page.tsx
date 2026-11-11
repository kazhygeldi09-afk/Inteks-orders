import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { fmt, type Dict } from "@/lib/i18n/dictionaries";
import { listDesigners } from "@/lib/queries";
import { applyFilters, filtersToQuery, readFilters, type OrderFilters } from "@/lib/orderFilters";
import { formatDate, formatMoney } from "@/lib/format";
import { isManager, STATUSES, type EnteredOrder, type OpenOrder, type Order } from "@/lib/types";
import { EnteredOrdersList, OrdersList } from "@/components/OrdersList";
import { Notice, PageTitle } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { takeOrder } from "./actions";

const LIMIT = 200;

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const params = await searchParams;
  const profile = await requireProfile();
  const { t, lang } = await getI18n();
  const supabase = await createClient();
  const errorKey = typeof params.error === "string" ? (params.error as keyof Dict["errors"]) : null;
  const banner = (
    <>
      {errorKey && <Notice kind="error">{t.errors[errorKey] ?? t.errors.GENERIC}</Notice>}
      {params.created && <Notice kind="ok">{t.orders.created}</Notice>}
    </>
  );

  // ---- Call center: only the orders they entered, no money -------------
  if (profile.role === "call_center") {
    const { data } = await supabase.rpc("my_entered_orders");
    const all = (data ?? []) as EnteredOrder[];
    const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
    const orders = q
      ? all.filter((o) =>
          [o.client_name, o.client_phone, o.client_address, String(o.order_number)].some((v) =>
            v.toLowerCase().includes(q),
          ),
        )
      : all;
    return (
      <div className="space-y-5">
        <PageTitle actions={<Link href="/orders/new" className="btn btn-primary">+ {t.nav.newOrder}</Link>}>
          {t.orders.titleEntered}
        </PageTitle>
        {banner}
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder={t.orders.searchPlaceholder} className="input max-w-sm" aria-label={t.orders.search} />
          <button className="btn btn-secondary">{t.orders.search}</button>
        </form>
        {orders.length === 0 ? (
          <p className="text-muted">{q ? t.orders.emptyFiltered : t.orders.empty}</p>
        ) : (
          <EnteredOrdersList orders={orders} t={t} lang={lang} />
        )}
      </div>
    );
  }

  // ---- Designers and managers ------------------------------------------
  const manager = isManager(profile.role);
  const filters = readFilters(params);
  const designers = manager ? await listDesigners() : [];

  const ordersQuery = applyFilters(
    supabase
      .from("orders")
      .select("*, designer:profiles!orders_designer_id_fkey(full_name)")
      .order("order_date", { ascending: false })
      .order("order_number", { ascending: false })
      .limit(LIMIT),
    filters,
  );
  const summaryDesigner = manager && filters.designer && filters.designer !== "none" ? filters.designer : null;

  const [{ data: orderRows }, { data: summary }, open] = await Promise.all([
    ordersQuery,
    supabase.rpc("unpaid_summary", { p_designer_id: summaryDesigner }).single(),
    profile.role === "designer" ? supabase.rpc("open_online_orders") : Promise.resolve({ data: [] }),
  ]);
  const orders = (orderRows ?? []) as Order[];
  const openOrders = (open.data ?? []) as OpenOrder[];
  const unpaid = summary as { total_unpaid: number; orders_with_balance: number } | null;
  const filtered = Boolean(filters.q || filters.designer || filters.status || filters.unpaid);
  const query = filtersToQuery(filters);

  return (
    <div className="space-y-6">
      <PageTitle
        actions={
          <>
            {manager && (
              <a href={`/orders/export${query ? `?${query}` : ""}`} className="btn btn-secondary">
                {t.orders.export}
              </a>
            )}
            <Link href="/orders/new" className="btn btn-primary">
              + {t.nav.newOrder}
            </Link>
          </>
        }
      >
        {manager ? t.orders.titleAll : t.orders.titleMine}
      </PageTitle>

      {banner}

      {openOrders.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{t.orders.openTitle}</h2>
            <p className="text-sm text-muted">{t.orders.openHint}</p>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {openOrders.map((o) => (
              <li key={o.id} className="card border-warn/40 bg-warn-soft/40 p-4">
                <p className="font-semibold">{o.client_name}</p>
                <p className="text-sm text-muted">
                  № {o.order_number} · {formatDate(o.order_date, lang)}
                </p>
                <p className="mt-2 text-sm">{[o.client_phone, o.client_address].filter(Boolean).join(" · ")}</p>
                {o.product_details && <p className="mt-1 text-sm whitespace-pre-line">{o.product_details}</p>}
                {o.notes && <p className="mt-1 text-sm text-muted whitespace-pre-line">{o.notes}</p>}
                <form action={takeOrder.bind(null, o.id)} className="mt-3">
                  <SubmitButton className="btn btn-primary btn-sm">{t.orders.take}</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Filters filters={filters} t={t} manager={manager} designers={designers} />
          {unpaid && (
            <div className="card w-full px-4 py-3 sm:w-auto sm:text-right">
              <p className="text-sm text-muted">{t.orders.unpaidTotal}</p>
              <p className="text-2xl font-semibold tabular-nums text-danger">
                {formatMoney(unpaid.total_unpaid, lang)}
              </p>
              <p className="text-xs text-muted">{fmt(t.orders.ordersWithBalance, { n: unpaid.orders_with_balance })}</p>
            </div>
          )}
        </div>

        {orders.length === 0 ? (
          <p className="text-muted">{filtered ? t.orders.emptyFiltered : t.orders.empty}</p>
        ) : (
          <OrdersList orders={orders} t={t} lang={lang} showDesigner={manager} />
        )}
        {orders.length === LIMIT && <p className="text-sm text-muted">{fmt(t.orders.limited, { n: LIMIT })}</p>}
      </section>
    </div>
  );
}

function Filters({
  filters,
  t,
  manager,
  designers,
}: {
  filters: OrderFilters;
  t: Dict;
  manager: boolean;
  designers: { id: string; full_name: string }[];
}) {
  return (
    <form className="flex flex-1 flex-wrap items-end gap-2">
      <div className="w-full sm:w-64">
        <label htmlFor="q" className="label">
          {t.orders.search}
        </label>
        <input id="q" name="q" defaultValue={filters.q} placeholder={t.orders.searchPlaceholder} className="input" />
      </div>
      {manager && (
        <div className="w-[calc(50%-0.25rem)] sm:w-48">
          <label htmlFor="designer" className="label">
            {t.fields.designer}
          </label>
          <select id="designer" name="designer" defaultValue={filters.designer} className="input">
            <option value="">{t.common.all}</option>
            <option value="none">{t.orders.unassigned}</option>
            {designers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="w-[calc(50%-0.25rem)] sm:w-44">
        <label htmlFor="status" className="label">
          {t.fields.status}
        </label>
        <select id="status" name="status" defaultValue={filters.status} className="input">
          <option value="">{t.common.all}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.statuses[s]}
            </option>
          ))}
        </select>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="unpaid" value="1" defaultChecked={filters.unpaid} className="size-4 accent-accent" />
        {t.orders.onlyUnpaid}
      </label>
      <div className="flex gap-2">
        <button className="btn btn-secondary">{t.common.apply}</button>
        <Link href="/orders" className="btn btn-secondary">
          {t.common.reset}
        </Link>
      </div>
    </form>
  );
}
