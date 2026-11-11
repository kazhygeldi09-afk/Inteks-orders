import type { Lang } from "@/lib/i18n/dictionaries";

const LOCALES: Record<Lang, string> = { kk: "kk-KZ", ru: "ru-KZ", en: "en-GB" };
export const TIME_ZONE = "Asia/Almaty";

export const localeOf = (lang: Lang) => LOCALES[lang];

/** 1250000 → "1 250 000 ₸" (grouping follows the language). */
export function formatMoney(value: number | string | null | undefined, lang: Lang) {
  const n = Number(value ?? 0);
  return `${new Intl.NumberFormat(LOCALES[lang], { maximumFractionDigits: 2 }).format(n)} ₸`;
}

/** "2026-11-05" → "5 Nov 2026". Date-only values are not time-zone shifted. */
export function formatDate(value: string | null | undefined, lang: Lang) {
  if (!value) return "—";
  const d = value.length === 10 ? new Date(`${value}T00:00:00Z`) : new Date(value);
  const timeZone = value.length === 10 ? "UTC" : TIME_ZONE;
  return new Intl.DateTimeFormat(LOCALES[lang], { dateStyle: "medium", timeZone }).format(d);
}

export function formatDateTime(value: string, lang: Lang) {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

export function monthName(month: number, lang: Lang) {
  const name = new Intl.DateTimeFormat(LOCALES[lang], { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, month - 1, 1)),
  );
  return name.charAt(0).toLocaleUpperCase(LOCALES[lang]) + name.slice(1);
}

/** Today's date in Kazakhstan as YYYY-MM-DD. */
export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}

/** "150 000,50" / "150,000.50" / "150000" → 150000.5; "" → null; junk → NaN. */
export function parseMoney(input: FormDataEntryValue | null): number | null {
  const raw = String(input ?? "").replace(/[\s ₸]/g, "");
  if (raw === "") return null;
  let s = raw;
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : NaN;
}
