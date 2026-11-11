import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { fmt, type Dict } from "@/lib/i18n/dictionaries";
import { getEnteredOrder, getOrder, isUuid, listDesigners } from "@/lib/queries";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { isManager, type OrderChange, type Payment } from "@/lib/types";
import { Notice, PageTitle, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { History } from "@/components/History";
import { AddPaymentForm, DeletePaymentButton } from "@/components/PaymentForms";
import { addPayment, deleteOrder, deletePayment } from "../actions";

export default async function OrderPage({ params, searchParams }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const { error } = await searchParams;
  if (!isUuid(id)) notFound();
  const profile = await requireProfile();
  const { t, lang } = await getI18n();

  // Call-center staff get a contact-details-only view of orders they entered.
  if (profile.role === "call_center") {
    const o = await getEnteredOrder(id);
    if (!o) notFound();
    return (
      <div className="max-w-2xl space-y-5">
        <PageTitle
          actions={
            o.editable && (
              <Link href={`/orders/${id}/edit`} className="btn btn-secondary">
                {t.common.edit}
              </Link>
            )
          }
        >
          {fmt(t.order.title, { n: o.order_number })} <StatusBadge status={o.status} t={t} />
        </PageTitle>
        <section className="card p-4 sm:p-5">
          <ClientDetails t={t} name={o.client_name} phone={o.client_phone} address={o.client_address} />
          <Detail label={t.fields.designer} value={o.designer_name ?? t.orders.waiting} />
          <Detail label={t.fields.productDetails} value={o.product_details} />
          <Detail label={t.fields.notes} value={o.notes} />
        </section>
        <Link href="/orders" className="btn btn-secondary">
          {t.common.back}
        </Link>
      </div>
    );
  }

  const order = await getOrder(id);
  if (!order) notFound();

  const supabase = await createClient();
  const [{ data: payments }, { data: changes }] = await Promise.all([
    supabase.from("payments").select("*").eq("order_id", id).order("paid_on").order("created_at"),
    supabase.from("order_changes").select("*").eq("order_id", id).order("changed_at", { ascending: false }),
  ]);

  const manager = isManager(profile.role);
  const names: Record<string, string> = { [profile.id]: profile.full_name };
  if (manager) for (const d of await listDesigners()) names[d.id] = d.full_name;
  if (order.designer_id && order.designer) names[order.designer_id] = order.designer.full_name;

  const remaining = Number(order.remaining_balance);

  return (
    <div className="space-y-5">
      <PageTitle
        actions={
          <>
            <Link href={`/orders/${id}/edit`} className="btn btn-secondary">
              {t.common.edit}
            </Link>
            {manager && (
              <form action={deleteOrder.bind(null, id)}>
                <SubmitButton className="btn btn-danger" confirmText={fmt(t.order.confirmDeleteOrder, { n: order.order_number })}>
                  {t.order.deleteOrder}
                </SubmitButton>
              </form>
            )}
          </>
        }
      >
        <span className="inline-flex flex-wrap items-center gap-2">
          {fmt(t.order.title, { n: order.order_number })}
          <StatusBadge status={order.status} t={t} />
        </span>
      </PageTitle>

      {error && <Notice kind="error">{t.errors[error as keyof Dict["errors"]] ?? t.errors.GENERIC}</Notice>}

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card p-4 sm:p-5 lg:col-span-2">
          <ClientDetails t={t} name={order.client_name} phone={order.client_phone} address={order.client_address} />
          <div className="grid gap-x-6 sm:grid-cols-2">
            <Detail label={t.fields.orderDate} value={formatDate(order.order_date, lang)} />
            <Detail
              label={t.fields.designer}
              value={order.designer?.full_name ?? t.orders.unassigned}
            />
            <Detail label={t.fields.source} value={t.sources[order.source]} />
          </div>
          <Detail label={t.fields.productDetails} value={order.product_details} />
          <Detail label={t.fields.notes} value={order.notes} />
        </section>

        <section className="card space-y-3 p-4 sm:p-5">
          <MoneyRow label={t.fields.totalCost} value={formatMoney(order.total_cost, lang)} />
          <MoneyRow label={t.fields.amountPaid} value={formatMoney(order.amount_paid, lang)} />
          <div className="border-t border-line pt-3">
            <p className="text-sm text-muted">{t.fields.remaining}</p>
            <p className={`text-3xl font-semibold tabular-nums ${remaining > 0 ? "text-danger" : "text-ok"}`}>
              {formatMoney(remaining, lang)}
            </p>
            {remaining <= 0 && Number(order.total_cost) > 0 && (
              <p className="text-sm text-ok">{t.order.paidInFull}</p>
            )}
          </div>
        </section>
      </div>

      <section className="card space-y-4 p-4 sm:p-5">
        <h2 className="text-lg font-semibold">{t.order.payments}</h2>
        {(payments ?? []).length === 0 ? (
          <p className="text-muted">{t.order.noPayments}</p>
        ) : (
          <ul className="divide-y divide-line">
            {(payments as Payment[]).map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                <div>
                  <p className="font-semibold tabular-nums">{formatMoney(p.amount, lang)}</p>
                  <p className="text-sm text-muted">
                    {formatDate(p.paid_on, lang)} · {t.methods[p.method]}
                    {p.note && ` · ${p.note}`} · {p.recorded_by_name}
                  </p>
                </div>
                <DeletePaymentButton action={deletePayment.bind(null, p.id, id)} reasonRequired={!manager} />
              </li>
            ))}
          </ul>
        )}
        {remaining > 0 && (
          <div className="border-t border-line pt-4">
            <AddPaymentForm action={addPayment.bind(null, id)} today={todayISO()} />
          </div>
        )}
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="mb-3 text-lg font-semibold">{t.order.history}</h2>
        <History changes={(changes ?? []) as OrderChange[]} t={t} lang={lang} names={names} />
      </section>
    </div>
  );
}

function ClientDetails({ t, name, phone, address }: { t: Dict; name: string; phone: string; address: string }) {
  return (
    <div className="mb-2">
      <p className="text-sm text-muted">{t.fields.client}</p>
      <p className="text-xl font-semibold">{name}</p>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {phone && (
          <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="text-accent underline-offset-2 hover:underline">
            {phone}
          </a>
        )}
        {address && <span>{address}</span>}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="mt-3">
      <p className="text-sm text-muted">{label}</p>
      <p className="whitespace-pre-line">{value}</p>
    </div>
  );
}

function MoneyRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </p>
  );
}
