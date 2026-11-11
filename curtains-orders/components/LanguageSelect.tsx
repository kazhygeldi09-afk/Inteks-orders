"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLanguage } from "@/lib/i18n/actions";
import { LANGS, LANG_NAMES } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/client";

export function LanguageSelect() {
  const { lang, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="inline-flex items-center gap-1.5 text-sm">
      <span className="sr-only">{t.language}</span>
      <select
        value={lang}
        disabled={pending}
        aria-label={t.language}
        className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            await setLanguage(next);
            router.refresh();
          });
        }}
      >
        {LANGS.map((l) => (
          <option key={l} value={l}>
            {LANG_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
