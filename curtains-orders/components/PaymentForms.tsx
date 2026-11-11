"use client";

import { useId, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { useServerForm } from "@/lib/useServerForm";
import type { FormState } from "@/lib/errors";
import { METHODS } from "@/lib/types";
import { Notice } from "@/components/ui";

export function AddPaymentForm({
  action,
  today,
}: {
  action: (fd: FormData) => Promise<FormState>;
  today: string;
}) {
  const { t } = useI18n();
  const { onSubmit, pending, state } = useServerForm(action, { resetOnOk: true });

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <h3 className="font-semibold">{t.order.addPayment}</h3>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor="amount">
            {t.order.amount}, ₸
          </label>
          <input id="amount" name="amount" inputMode="decimal" required className="input" placeholder="0" autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="paid_on">
            {t.order.date}
          </label>
          <input id="paid_on" name="paid_on" type="date" defaultValue={today} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="method">
            {t.order.method}
          </label>
          <select id="method" name="method" defaultValue="kaspi" className="input">
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {t.methods[m]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="note">
            {t.order.note}
          </label>
          <input id="note" name="note" className="input" autoComplete="off" />
        </div>
      </div>
      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.ok && <Notice kind="ok">{t.order.paymentAdded}</Notice>}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? t.common.saving : t.order.addPayment}
      </button>
    </form>
  );
}

export function DeletePaymentButton({
  action,
  reasonRequired,
}: {
  action: (fd: FormData) => Promise<FormState>;
  reasonRequired: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const reasonId = useId();
  const { onSubmit, pending, state } = useServerForm(action);

  if (!open) {
    return (
      <button type="button" className="btn btn-danger btn-sm" onClick={() => setOpen(true)}>
        {t.common.delete}
      </button>
    );
  }
  return (
    <form onSubmit={onSubmit} className="mt-2 space-y-2">
      <label className="label" htmlFor={reasonId}>
        {t.order.deletePaymentReason}
      </label>
      <input
        id={reasonId}
        name="reason"
        required={reasonRequired}
        minLength={reasonRequired ? 3 : undefined}
        className="input"
        autoFocus
        autoComplete="off"
      />
      {state.error && <Notice kind="error">{state.error}</Notice>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn btn-danger btn-sm">
          {pending ? t.common.saving : t.order.deletePayment}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>
          {t.common.cancel}
        </button>
      </div>
    </form>
  );
}
