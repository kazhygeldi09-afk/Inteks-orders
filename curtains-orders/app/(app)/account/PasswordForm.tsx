"use client";

import { useI18n } from "@/lib/i18n/client";
import { useServerForm } from "@/lib/useServerForm";
import { Notice } from "@/components/ui";
import { changePassword } from "./actions";

export function PasswordForm() {
  const { t } = useI18n();
  const { onSubmit, pending, state } = useServerForm(changePassword, { resetOnOk: true });

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-4 sm:p-5">
      <h2 className="font-semibold">{t.account.changePassword}</h2>
      <div>
        <label htmlFor="password" className="label">
          {t.account.newPassword}
        </label>
        <input id="password" name="password" type="password" minLength={8} required className="input" autoComplete="new-password" />
      </div>
      <div>
        <label htmlFor="confirm" className="label">
          {t.account.confirmPassword}
        </label>
        <input id="confirm" name="confirm" type="password" minLength={8} required className="input" autoComplete="new-password" />
      </div>
      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.ok && <Notice kind="ok">{t.account.changed}</Notice>}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? t.common.saving : t.account.changePassword}
      </button>
    </form>
  );
}
