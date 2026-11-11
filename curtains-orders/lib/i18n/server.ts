import { cookies } from "next/headers";
import { DEFAULT_LANG, dictionaries, isLang, type Lang } from "./dictionaries";

export const LANG_COOKIE = "lang";

export async function getLang(): Promise<Lang> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(value) ? value : DEFAULT_LANG;
}

export async function getI18n() {
  const lang = await getLang();
  return { lang, t: dictionaries[lang] };
}
