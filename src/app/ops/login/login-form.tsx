"use client";

import { useActionState } from "react";
import { login } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block">
        <span className="text-sm font-semibold">Staff password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2"
        />
      </label>
      {state && !state.ok && <p role="alert" className="text-danger text-sm">{state.message}</p>}
      <button disabled={pending} className="w-full rounded-full bg-brand py-2.5 font-semibold text-white disabled:opacity-60">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
