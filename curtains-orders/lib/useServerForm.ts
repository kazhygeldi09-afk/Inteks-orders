"use client";

import { useState, useTransition } from "react";
import type { FormState } from "@/lib/errors";

/**
 * Submits a form to a server action without React's automatic form reset,
 * so typed values stay in place when the server returns an error.
 */
export function useServerForm(
  action: (formData: FormData) => Promise<FormState | void>,
  { resetOnOk = false } = {},
) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>({});

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = (await action(formData)) ?? {};
      setState(result);
      if (result.ok && resetOnOk) form.reset();
    });
  };

  return { onSubmit, pending, state };
}
