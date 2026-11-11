"use client";

import { useFormStatus } from "react-dom";
import { useI18n } from "@/lib/i18n/client";

export function SubmitButton({
  children,
  className = "btn btn-primary",
  confirmText,
}: {
  children: React.ReactNode;
  className?: string;
  confirmText?: string;
}) {
  const { pending } = useFormStatus();
  const { t } = useI18n();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {pending ? t.common.saving : children}
    </button>
  );
}
