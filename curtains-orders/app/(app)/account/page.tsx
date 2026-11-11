import { requireProfile } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { PageTitle } from "@/components/ui";
import { PasswordForm } from "./PasswordForm";

export default async function AccountPage() {
  const me = await requireProfile();
  const { t } = await getI18n();
  return (
    <div className="max-w-md space-y-5">
      <PageTitle>{t.account.title}</PageTitle>
      <div className="card p-4">
        <p className="font-semibold">{me.full_name}</p>
        <p className="text-sm text-muted">
          {me.email} · {t.roles[me.role]}
        </p>
      </div>
      <PasswordForm />
    </div>
  );
}
