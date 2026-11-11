"use client";

import { useId } from "react";
import { useI18n } from "@/lib/i18n/client";
import { useServerForm } from "@/lib/useServerForm";
import type { FormState } from "@/lib/errors";
import { ROLES, type Profile, type Role } from "@/lib/types";
import { Notice } from "@/components/ui";

type Action = (fd: FormData) => Promise<FormState>;

export function AddStaffForm({ action, canMakeOwner }: { action: Action; canMakeOwner: boolean }) {
  const { t } = useI18n();
  const { onSubmit, pending, state } = useServerForm(action, { resetOnOk: true });

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-4 sm:p-5">
      <h2 className="text-lg font-semibold">{t.staff.add}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="new_full_name" className="label">
            {t.staff.fullName}
          </label>
          <input id="new_full_name" name="full_name" required className="input" autoComplete="off" />
        </div>
        <div>
          <label htmlFor="new_email" className="label">
            {t.staff.email}
          </label>
          <input id="new_email" name="email" type="email" required className="input" autoComplete="off" />
        </div>
        <div>
          <label htmlFor="new_role" className="label">
            {t.staff.role}
          </label>
          <RoleSelect id="new_role" defaultValue="designer" canMakeOwner={canMakeOwner} />
        </div>
        <div>
          <label htmlFor="new_password" className="label">
            {t.staff.tempPassword}
          </label>
          <input id="new_password" name="password" type="text" required minLength={8} className="input" autoComplete="new-password" />
          <p className="hint">{t.staff.tempPasswordHint}</p>
        </div>
      </div>
      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.ok && <Notice kind="ok">{t.staff.created}</Notice>}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? t.common.saving : t.staff.add}
      </button>
    </form>
  );
}

export function StaffRow({
  person,
  isMe,
  canEdit,
  canMakeOwner,
  update,
  setPassword,
}: {
  person: Profile;
  isMe: boolean;
  canEdit: boolean;
  canMakeOwner: boolean;
  update: Action;
  setPassword: Action;
}) {
  const { t } = useI18n();
  const id = useId();
  const save = useServerForm(update);
  const pw = useServerForm(setPassword, { resetOnOk: true });

  return (
    <li className="card space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          {person.full_name || "—"}
          {isMe && <span className="ml-1 text-sm font-normal text-muted">({t.staff.you})</span>}
        </p>
        <p className="text-sm text-muted">{person.email}</p>
      </div>

      {canEdit ? (
        <>
          <form onSubmit={save.onSubmit} className="flex flex-wrap items-end gap-2">
            <div className="w-full sm:w-56">
              <label htmlFor={`${id}-name`} className="label">
                {t.staff.fullName}
              </label>
              <input id={`${id}-name`} name="full_name" defaultValue={person.full_name} required className="input" />
            </div>
            <div className="w-full sm:w-44">
              <label htmlFor={`${id}-role`} className="label">
                {t.staff.role}
              </label>
              <RoleSelect id={`${id}-role`} defaultValue={person.role ?? "designer"} canMakeOwner={canMakeOwner} disabled={isMe} />
              {isMe && <input type="hidden" name="role" value={person.role ?? ""} />}
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={person.active} disabled={isMe} className="size-4 accent-accent" />
              {t.staff.active}
              {isMe && <input type="hidden" name="active" value="on" />}
            </label>
            <button type="submit" disabled={save.pending} className="btn btn-secondary">
              {save.pending ? t.common.saving : t.common.save}
            </button>
          </form>
          {save.state.error && <Notice kind="error">{save.state.error}</Notice>}
          {save.state.ok && <Notice kind="ok">{t.staff.saved}</Notice>}

          {!isMe && (
            <form onSubmit={pw.onSubmit} className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
              <div className="w-full sm:w-56">
                <label htmlFor={`${id}-pw`} className="label">
                  {t.staff.newPassword}
                </label>
                <input id={`${id}-pw`} name="password" type="text" minLength={8} required className="input" autoComplete="new-password" />
              </div>
              <button type="submit" disabled={pw.pending} className="btn btn-secondary">
                {pw.pending ? t.common.saving : t.staff.setPassword}
              </button>
            </form>
          )}
          {pw.state.error && <Notice kind="error">{pw.state.error}</Notice>}
          {pw.state.ok && <Notice kind="ok">{t.staff.passwordSet}</Notice>}
        </>
      ) : (
        <p className="text-sm">
          {person.role ? t.roles[person.role] : "—"} · {person.active ? t.staff.active : t.staff.inactive}
        </p>
      )}
    </li>
  );
}

function RoleSelect({
  id,
  defaultValue,
  canMakeOwner,
  disabled,
}: {
  id: string;
  defaultValue: Role;
  canMakeOwner: boolean;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <select id={id} name="role" defaultValue={defaultValue} disabled={disabled} className="input">
      {ROLES.filter((r) => canMakeOwner || r !== "owner" || r === defaultValue).map((r) => (
        <option key={r} value={r}>
          {t.roles[r]}
        </option>
      ))}
    </select>
  );
}
