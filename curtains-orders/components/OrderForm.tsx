"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/client";
import { useServerForm } from "@/lib/useServerForm";
import { formatMoney, parseMoney } from "@/lib/format";
import type { FormState } from "@/lib/errors";
import { isManager, METHODS, STATUSES, type Role } from "@/lib/types";
import { Notice } from "@/components/ui";

export type OrderFormValues = {
  client_name: string;
  client_phone: string;
  client_address: string;
  order_date: string;
  product_details: string;
  notes: string;
  total_cost: string;
  status: string;
  designer_id: string;
  source: string;
};

type Props = {
  mode: "create" | "edit";
  role: Role;
  initial: OrderFormValues;
  amountPaid?: number;
  designers?: { id: string; full_name: string }[];
  action: (fd: FormData) => Promise<FormState>;
  cancelHref: string;
};

export function OrderForm({ mode, role, initial, amountPaid = 0, designers = [], action, cancelHref }: Props) {
  const { t, lang } = useI18n();
  const { onSubmit, pending, state } = useServerForm(action);
  const [total, setTotal] = useState(initial.total_cost);
  const [deposit, setDeposit] = useState("");

  const manager = isManager(role);
  const money = role !== "call_center";
  const paid = mode === "create" ? parseMoney(deposit) ?? 0 : amountPaid;
  const totalNum = parseMoney(total) ?? 0;
  const remaining = Number.isNaN(totalNum) || Number.isNaN(paid) ? null : totalNum - paid;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="card space-y-4 p-4 sm:p-5">
        <h2 className="font-semibold">{t.fields.client}</h2>
        <Field label={t.fields.clientName} id="client_name">
          <input id="client_name" name="client_name" required defaultValue={initial.client_name} className="input" autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.fields.phone} id="client_phone">
            <input id="client_phone" name="client_phone" type="tel" inputMode="tel" defaultValue={initial.client_phone} className="input" placeholder="+7 7__ ___ __ __" autoComplete="off" />
          </Field>
          <Field label={t.fields.address} id="client_address">
            <input id="client_address" name="client_address" defaultValue={initial.client_address} className="input" autoComplete="off" />
          </Field>
        </div>
        <Field label={t.fields.productDetails} id="product_details" hint={t.fields.productDetailsHint}>
          <textarea id="product_details" name="product_details" rows={3} defaultValue={initial.product_details} className="input" />
        </Field>
        <Field label={t.fields.notes} id="notes">
          <textarea id="notes" name="notes" rows={2} defaultValue={initial.notes} className="input" />
        </Field>
      </section>

      {money && (
        <section className="card space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.fields.orderDate} id="order_date">
              <input id="order_date" name="order_date" type="date" required defaultValue={initial.order_date} className="input" />
            </Field>
            <Field label={t.fields.status} id="status">
              <select id="status" name="status" defaultValue={initial.status} className="input">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t.statuses[s]}
                  </option>
                ))}
              </select>
            </Field>
            {manager && (
              <>
                <Field label={t.fields.designer} id="designer_id">
                  <select id="designer_id" name="designer_id" defaultValue={initial.designer_id} className="input">
                    <option value="">{t.orders.unassigned}</option>
                    {designers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t.fields.source} id="source">
                  <select id="source" name="source" defaultValue={initial.source} className="input">
                    <option value="designer">{t.sources.designer}</option>
                    <option value="online">{t.sources.online}</option>
                  </select>
                </Field>
              </>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`${t.fields.totalCost}, ₸`} id="total_cost">
              <input
                id="total_cost"
                name="total_cost"
                inputMode="decimal"
                required={role === "designer"}
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                className="input"
                placeholder="0"
                autoComplete="off"
              />
            </Field>
            {mode === "create" ? (
              <>
                <Field label={`${t.fields.deposit}, ₸`} id="deposit" hint={t.newOrder.depositHint}>
                  <input
                    id="deposit"
                    name="deposit"
                    inputMode="decimal"
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                    className="input"
                    placeholder="0"
                    autoComplete="off"
                  />
                </Field>
                <Field label={t.fields.depositMethod} id="deposit_method">
                  <select id="deposit_method" name="deposit_method" defaultValue="kaspi" className="input">
                    {METHODS.map((m) => (
                      <option key={m} value={m}>
                        {t.methods[m]}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            ) : (
              <div>
                <span className="label">{t.fields.amountPaid}</span>
                <p className="py-2.5">{formatMoney(amountPaid, lang)}</p>
              </div>
            )}
          </div>

          <p className="flex items-baseline justify-between rounded-lg bg-canvas px-3 py-2.5">
            <span className="text-sm text-muted">{t.fields.remaining}</span>
            <span className="text-lg font-semibold tabular-nums">
              {remaining === null ? "—" : formatMoney(remaining, lang)}
            </span>
          </p>
        </section>
      )}

      {mode === "edit" && (
        <section className="card p-4 sm:p-5">
          <Field
            label={manager ? t.editOrder.reasonOptional : t.editOrder.reason}
            id="reason"
            hint={manager ? undefined : t.editOrder.reasonHint}
          >
            <textarea id="reason" name="reason" rows={2} required={!manager} minLength={manager ? undefined : 3} className="input" />
          </Field>
        </section>
      )}

      {state.error && <Notice kind="error">{state.error}</Notice>}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? t.common.saving : mode === "create" ? t.newOrder.submit : t.editOrder.submit}
        </button>
        <Link href={cancelHref} className="btn btn-secondary">
          {t.common.cancel}
        </Link>
      </div>
    </form>
  );
}

function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
