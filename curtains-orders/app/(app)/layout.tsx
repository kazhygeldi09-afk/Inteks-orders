import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { isManager } from "@/lib/types";
import { signOut } from "@/app/login/actions";
import { LanguageSelect } from "@/components/LanguageSelect";
import { NavLinks } from "@/components/NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const { t } = await getI18n();

  const items = [
    { href: "/orders", label: t.nav.orders },
    { href: "/orders/new", label: t.nav.newOrder },
    ...(isManager(profile.role)
      ? [
          { href: "/reports", label: t.nav.reports },
          { href: "/staff", label: t.nav.staff },
        ]
      : []),
    { href: "/account", label: t.nav.account },
  ];

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-center justify-between gap-3 py-3">
            <Link href="/orders" className="font-semibold tracking-tight">
              {t.appName}
            </Link>
            <div className="flex items-center gap-3">
              <span className="hidden text-right text-sm leading-tight sm:block">
                {profile.full_name || profile.email}
                <span className="block text-xs text-muted">{t.roles[profile.role]}</span>
              </span>
              <LanguageSelect />
              <form action={signOut}>
                <button className="btn btn-secondary btn-sm">{t.nav.signOut}</button>
              </form>
            </div>
          </div>
          <div className="pb-2">
            <NavLinks items={items} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
