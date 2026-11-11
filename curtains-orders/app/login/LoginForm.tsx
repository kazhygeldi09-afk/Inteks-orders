"use client";

import { signIn } from "./actions";
import { useI18n } from "@/lib/i18n/client";
import { useServerForm } from "@/lib/useServerForm";
import { Notice } from "@/components/ui";

export function LoginForm() {
  const { t } = useI18n();
  const { onSubmit, pending, state } = useServerForm(signIn);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">
          {t.login.email}
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          {t.login.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </div>
      {state.error && <Notice kind="error">{state.error}</Notice>}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? t.common.saving : t.login.submit}
      </button>
    </form>
  );
}
