"use client";

import { startTransition, useActionState, type ReactNode } from "react";

type State = { ok: boolean; message: string } | null;

/**
 * A form bound to a server action that returns { ok, message }; shows the
 * message after saving. Submitted manually (not via the `action` prop) so the
 * fields keep what the user typed, especially after a validation error.
 */
export function ActionForm({
  action, children, submit, className = "space-y-3", confirm: confirmText, buttonClass = "btn-primary py-2.5", id,
}: {
  id?: string;
  action: (prev: State, formData: FormData) => Promise<State>;
  children: ReactNode;
  submit: string;
  className?: string;
  confirm?: string;
  buttonClass?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      id={id}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmText && !window.confirm(confirmText)) return;
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => formAction(fd));
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={buttonClass}>{pending ? "Saving…" : submit}</button>
        {state && <p role="status" className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>}
      </div>
    </form>
  );
}
