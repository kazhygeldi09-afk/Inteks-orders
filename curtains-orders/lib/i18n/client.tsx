"use client";

import { createContext, useContext } from "react";
import { dictionaries, type Dict, type Lang } from "./dictionaries";

const I18nContext = createContext<{ lang: Lang; t: Dict }>({
  lang: "ru",
  t: dictionaries.ru,
});

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    <I18nContext.Provider value={{ lang, t: dictionaries[lang] }}>{children}</I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
