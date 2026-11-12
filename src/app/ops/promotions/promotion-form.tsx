"use client";

import { useActionState, useState } from "react";
import { createPromotion } from "../actions";

export function PromotionForm() {
  const [state, action, pending] = useActionState(createPromotion, null);
  const [withCoupon, setWithCoupon] = useState(true);
  const [type, setType] = useState("PERCENT");
  return (
    <form action={action} className="mt-4 space-y-3 text-sm">
      <label className="block"><span className="font-semibold">Title</span><input name="title" required maxLength={80} placeholder="Sallah special: 10% off 50kg" className="field" /></label>
      <label className="block"><span className="font-semibold">Description</span><textarea name="body" required rows={3} maxLength={400} className="field" /></label>
      <label className="block"><span className="font-semibold">Badge <span className="font-normal text-muted">(optional)</span></span><input name="badge" maxLength={24} placeholder="Limited time" className="field" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="font-semibold">Starts</span><input name="startsAt" type="date" className="field" /></label>
        <label className="block"><span className="font-semibold">Ends</span><input name="endsAt" type="date" className="field" /></label>
      </div>
      <label className="flex items-center gap-2 pt-2">
        <input type="checkbox" checked={withCoupon} onChange={(e) => setWithCoupon(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
        <span className="font-semibold">Include a coupon code</span>
      </label>
      {withCoupon && (
        <div className="space-y-3 rounded-xl bg-background p-3">
          <label className="block"><span className="font-semibold">Code</span><input name="couponCode" required maxLength={20} placeholder="SALLAH10" className="field uppercase" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="font-semibold">Type</span>
              <select name="couponType" value={type} onChange={(e) => setType(e.target.value)} className="field">
                <option value="PERCENT">% off</option>
                <option value="FIXED">₦ off</option>
              </select>
            </label>
            <label className="block"><span className="font-semibold">{type === "PERCENT" ? "Percent" : "Amount ₦"}</span><input name="couponValue" required inputMode="decimal" className="field" /></label>
            <label className="block"><span className="font-semibold">Min order ₦</span><input name="couponMinOrder" inputMode="decimal" className="field" /></label>
            {type === "PERCENT" && <label className="block"><span className="font-semibold">Max discount ₦</span><input name="couponMaxDiscount" inputMode="decimal" className="field" /></label>}
            <label className="block"><span className="font-semibold">Max uses</span><input name="couponMaxUses" inputMode="numeric" placeholder="Unlimited" className="field" /></label>
          </div>
        </div>
      )}
      {state && <p role="status" className={state.ok ? "text-success" : "text-danger"}>{state.message}</p>}
      <button disabled={pending} className="btn-primary w-full py-2.5">{pending ? "Publishing…" : "Publish promotion"}</button>
    </form>
  );
}
