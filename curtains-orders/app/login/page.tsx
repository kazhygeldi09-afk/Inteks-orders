import { getI18n } from "@/lib/i18n/server";
import { LanguageSelect } from "@/components/LanguageSelect";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const { t } = await getI18n();
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-accent">{t.appName}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t.login.title}</h1>
            <p className="mt-1 text-sm text-muted">{t.login.subtitle}</p>
          </div>
          <LanguageSelect />
        </div>
        <div className="card p-5">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
