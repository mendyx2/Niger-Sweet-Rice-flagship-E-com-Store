"use client";

import { useActionState } from "react";
import { reviewClaim } from "../actions";

export function ClaimReview({ claimId }: { claimId: string }) {
  const [state, action, pending] = useActionState(reviewClaim, null);
  return (
    <form action={action} className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
      <input type="hidden" name="claimId" value={claimId} />
      <label className="text-sm flex-1 min-w-48">
        <span className="block font-semibold">Note to customer <span className="font-normal text-muted">(required to reject)</span></span>
        <input name="note" maxLength={300} className="field mt-1 py-2" />
      </label>
      <button name="decision" value="approve" disabled={pending} className="btn-primary py-2.5">Approve replacement</button>
      <button name="decision" value="reject" disabled={pending} className="btn-outline py-2.5">Reject</button>
      {state && <p role="status" className={`w-full text-sm ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>}
    </form>
  );
}
