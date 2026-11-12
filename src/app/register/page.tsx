import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { SellerForm } from "../account/forms";

export const metadata: Metadata = {
  title: "Sell or resell our rice: wholesale application",
  description: "Shops, caterers and distributors in Abuja can apply for wholesale rice prices.",
};

export default function RegisterPage({ searchParams }: PageProps<"/register">) {
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="card p-6 sm:p-8">
        <h1 className="font-display text-3xl font-bold">Sell or resell our rice</h1>
        <p className="mt-2 text-muted">
          Shops, caterers, restaurants and distributors get wholesale prices once approved. Tell us about your business.
        </p>
        <div className="mt-6">
          <Suspense fallback={<div className="h-64" />}>
            <Register searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function Register({ searchParams }: Pick<PageProps<"/register">, "searchParams">) {
  const sp = await searchParams;
  // Buyers don't need a separate sign-up: signing in with a phone number creates the account.
  if (sp.as !== "seller") redirect("/login");
  const user = await requireUser("/register?as=seller");
  const p = user.sellerProfile;
  if (p?.status === "APPROVED") redirect("/account");
  if (p?.status === "PENDING") {
    return <p className="rounded-xl bg-brand-soft p-4 text-brand font-medium">Your application for {p.businessName} is under review. We&apos;ll text you when it&apos;s approved.</p>;
  }
  return <SellerForm name={user.name ?? ""} defaults={p ? { businessName: p.businessName, cacNumber: p.cacNumber, address: p.address } : undefined} />;
}
