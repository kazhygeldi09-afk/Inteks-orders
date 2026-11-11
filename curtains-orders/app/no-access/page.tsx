import { getI18n } from "@/lib/i18n/server";
import { signOut } from "@/app/login/actions";
import { LanguageSelect } from "@/components/LanguageSelect";

export default async function NoAccessPage() {
  const { t } = await getI18n();
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-3 flex justify-end">
          <LanguageSelect />
        </div>
        <h1 className="text-xl font-semibold">{t.noAccess.title}</h1>
        <p className="mt-2 text-muted">{t.noAccess.body}</p>
        <form action={signOut} className="mt-5">
          <button className="btn btn-secondary w-full">{t.nav.signOut}</button>
        </form>
      </div>
    </main>
  );
}
