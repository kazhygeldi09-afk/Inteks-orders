import { requireProfile } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { listDesigners } from "@/lib/queries";
import { todayISO } from "@/lib/format";
import { isManager } from "@/lib/types";
import { OrderForm } from "@/components/OrderForm";
import { PageTitle } from "@/components/ui";
import { createOrder } from "../actions";

export default async function NewOrderPage() {
  const profile = await requireProfile();
  const { t } = await getI18n();
  const designers = isManager(profile.role) ? await listDesigners() : [];
  const online = profile.role === "call_center";

  return (
    <div className="max-w-2xl">
      <PageTitle>{online ? t.newOrder.titleOnline : t.newOrder.title}</PageTitle>
      {online && <p className="-mt-3 mb-5 text-muted">{t.newOrder.hintOnline}</p>}
      <OrderForm
        mode="create"
        role={profile.role}
        designers={designers}
        action={createOrder}
        cancelHref="/orders"
        initial={{
          client_name: "",
          client_phone: "",
          client_address: "",
          order_date: todayISO(),
          product_details: "",
          notes: "",
          total_cost: "",
          status: "new",
          designer_id: "",
          source: "designer",
        }}
      />
    </div>
  );
}
