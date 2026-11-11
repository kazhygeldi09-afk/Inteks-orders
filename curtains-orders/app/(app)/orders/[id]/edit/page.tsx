import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dictionaries";
import { getEnteredOrder, getOrder, isUuid, listDesigners } from "@/lib/queries";
import { isManager } from "@/lib/types";
import { OrderForm, type OrderFormValues } from "@/components/OrderForm";
import { Notice, PageTitle } from "@/components/ui";
import { updateOrder } from "../../actions";

export default async function EditOrderPage({ params }: PageProps<"/orders/[id]/edit">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const profile = await requireProfile();
  const { t } = await getI18n();

  let initial: OrderFormValues;
  let number: number;
  let amountPaid = 0;

  if (profile.role === "call_center") {
    const o = await getEnteredOrder(id);
    if (!o) notFound();
    if (!o.editable) {
      return (
        <div className="max-w-2xl space-y-4">
          <PageTitle>{fmt(t.editOrder.title, { n: o.order_number })}</PageTitle>
          <Notice kind="error">{t.editOrder.lockedForCallCenter}</Notice>
          <Link href="/orders" className="btn btn-secondary">
            {t.common.back}
          </Link>
        </div>
      );
    }
    number = o.order_number;
    initial = {
      client_name: o.client_name,
      client_phone: o.client_phone,
      client_address: o.client_address,
      order_date: o.order_date,
      product_details: o.product_details,
      notes: o.notes,
      total_cost: "",
      status: o.status,
      designer_id: "",
      source: "online",
    };
  } else {
    const o = await getOrder(id);
    if (!o) notFound();
    number = o.order_number;
    amountPaid = Number(o.amount_paid);
    initial = {
      client_name: o.client_name,
      client_phone: o.client_phone,
      client_address: o.client_address,
      order_date: o.order_date,
      product_details: o.product_details,
      notes: o.notes,
      total_cost: String(Number(o.total_cost)),
      status: o.status,
      designer_id: o.designer_id ?? "",
      source: o.source,
    };
  }

  const designers = isManager(profile.role) ? await listDesigners() : [];
  const cancelHref = profile.role === "call_center" ? "/orders" : `/orders/${id}`;

  return (
    <div className="max-w-2xl">
      <PageTitle>{fmt(t.editOrder.title, { n: number })}</PageTitle>
      <OrderForm
        mode="edit"
        role={profile.role}
        initial={initial}
        amountPaid={amountPaid}
        designers={designers}
        action={updateOrder.bind(null, id)}
        cancelHref={cancelHref}
      />
    </div>
  );
}
