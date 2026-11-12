"use client";

import { useActionState, useEffect, useRef } from "react";
import { requestCode, verifyCode, type OtpState } from "./actions";
import { formatNgPhone } from "@/lib/phone";

/** Two-step phone sign-in: number → SMS code. Used on /login and inside checkout. */
export function OtpForm({ next }: { next: string }) {
  const [sendState, send, sending] = useActionState<OtpState, FormData>(requestCode, { step: "phone" });
  const [verifyState, verify, verifying] = useActionState<OtpState | null, FormData>(verifyCode, null);
  const codeRef = useRef<HTMLInputElement>(null);

  const onCodeStep = sendState.step === "code" && verifyState?.step !== "phone";
  const phone = sendState.step === "code" ? sendState.phone : "";

  useEffect(() => {
    if (onCodeStep) codeRef.current?.focus();
  }, [onCodeStep]);

  if (!onCodeStep) {
    const error = sendState.error ?? (verifyState?.step === "phone" ? verifyState.error : undefined);
    return (
      <form action={send} className="space-y-4" noValidate>
        <label className="block">
          <span className="text-sm font-semibold">Mobile number</span>
          <div className="mt-1 flex rounded-xl border border-border bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
            <span className="flex items-center pl-3 pr-2 text-muted border-r border-border">🇳🇬 +234</span>
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              required
              placeholder="0801 234 5678"
              defaultValue={sendState.step === "phone" ? sendState.phone : ""}
              aria-invalid={!!error}
              aria-describedby={error ? "phone-error" : "phone-help"}
              className="w-full rounded-r-xl bg-transparent px-3 py-3 text-base outline-none"
            />
          </div>
          <span id="phone-help" className="mt-1 block text-xs text-muted">We&apos;ll text you a code. No password needed.</span>
        </label>
        {error && <p id="phone-error" role="alert" className="text-sm text-danger">{error}</p>}
        <button disabled={sending} className="btn-cta w-full">{sending ? "Sending code…" : "Send code"}</button>
      </form>
    );
  }

  const error = verifyState?.step === "code" ? verifyState.error : undefined;
  return (
    <div className="space-y-4">
      <form action={verify} className="space-y-4">
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="next" value={next} />
        <p className="text-sm">
          Enter the 6-digit code sent to <strong>{formatNgPhone(phone)}</strong>.
        </p>
        {sendState.step === "code" && sendState.devCode && (
          <p className="rounded-lg bg-promo-soft px-3 py-2 text-xs">
            Development mode (no SMS provider): your code is <strong className="tracking-widest">{sendState.devCode}</strong>
          </p>
        )}
        <input
          ref={codeRef}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          aria-label="6-digit code"
          aria-invalid={!!error}
          className="field text-center text-2xl tracking-[0.5em] font-semibold"
        />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button disabled={verifying} className="btn-cta w-full">{verifying ? "Checking…" : "Verify & continue"}</button>
      </form>
      <form action={send} className="flex justify-between text-sm">
        <input type="hidden" name="phone" value={phone} />
        <button type="button" onClick={() => location.reload()} className="text-muted underline">Change number</button>
        <button disabled={sending} className="font-semibold text-brand underline">{sending ? "Sending…" : "Resend code"}</button>
      </form>
    </div>
  );
}
