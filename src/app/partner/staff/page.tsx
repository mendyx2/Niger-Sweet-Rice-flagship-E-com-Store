import { Suspense } from "react";
import { db } from "@/lib/db";
import { requirePartner } from "@/lib/partner-auth";
import { formatNgPhone } from "@/lib/phone";
import { ActionForm } from "@/components/action-form";
import { PartnerNav } from "../partner-nav";
import { addStaff, removeStaff } from "../actions";

export default function StaffPage() {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}><Staff /></Suspense>;
}

async function Staff() {
  const { distributor, member, user } = await requirePartner({ ownerOnly: true, next: "/partner/staff" });
  const members = await db.distributorMember.findMany({ where: { distributorId: distributor.id }, include: { user: true }, orderBy: { createdAt: "asc" } });
  return (
    <>
      <PartnerNav current="staff" name={distributor.name} isOwner={member.role === "OWNER"} />
      <h1 className="font-display text-2xl font-bold">Staff</h1>
      <p className="mt-1 text-sm text-muted">Staff can handle orders, stock and shop sales. Only owners can change prices, delivery fees and staff.</p>
      <ul className="mt-4 card divide-y divide-border text-sm">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-3 p-4">
            <span>{m.user.name ?? "No name"} · {formatNgPhone(m.user.phone)} <span className="ml-1 text-xs text-muted">{m.role === "OWNER" ? "Owner" : "Staff"}{m.userId === user.id ? " (you)" : ""}</span></span>
            {m.role === "STAFF" && (
              <form action={removeStaff}><input type="hidden" name="userId" value={m.userId} /><button className="text-danger underline">Remove</button></form>
            )}
          </li>
        ))}
      </ul>
      <section className="mt-6 card p-5 max-w-lg">
        <h2 className="font-semibold text-lg">Add a staff member</h2>
        <ActionForm action={addStaff} submit="Add staff" className="mt-3 space-y-3 text-sm">
          <label className="block"><span className="font-semibold">Name</span><input name="name" className="field" /></label>
          <label className="block"><span className="font-semibold">Mobile number</span><input name="phone" type="tel" required className="field" /></label>
        </ActionForm>
      </section>
    </>
  );
}
