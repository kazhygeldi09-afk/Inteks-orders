"use server";

import { cookies } from "next/headers";
import { isLang } from "./dictionaries";
import { LANG_COOKIE } from "./server";

export async function setLanguage(lang: string) {
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
