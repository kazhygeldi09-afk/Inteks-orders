import type { Dict } from "@/lib/i18n/dictionaries";

const CODES = [
  "NOT_ALLOWED",
  "NOT_FOUND",
  "REASON_REQUIRED",
  "OVERPAID",
  "TOTAL_BELOW_PAID",
  "ALREADY_TAKEN",
  "INVALID_AMOUNT",
  "INVALID_DESIGNER",
  "CLIENT_NAME_REQUIRED",
] as const;
export type ErrorCode = (typeof CODES)[number] | "GENERIC";

/** Turns a database error into a short code the screens can translate. */
export function errorCode(error: { message?: string } | null | undefined): ErrorCode {
  const msg = error?.message ?? "";
  const found = CODES.find((c) => msg.includes(c));
  if (found) return found;
  console.error("Unexpected database error:", msg);
  return "GENERIC";
}

export function errorText(code: ErrorCode, t: Dict) {
  return t.errors[code];
}

export type FormState = { error?: string; ok?: boolean };
