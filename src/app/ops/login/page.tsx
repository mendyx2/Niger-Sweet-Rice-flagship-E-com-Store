import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getHqStaff } from "@/lib/ops-auth";
import { site } from "@/lib/site";
import { OtpForm } from "../../login/otp-form";
import { signOut } from "../../login/actions";

export default function OpsLoginPage({ searchParams }: PageProps<"/ops/login">) {
  return (
    <div className="max-w-sm mx-auto mt-10">
      <h1 className="font-display text-2xl font-bold">HQ staff sign in</h1>
      <p className="text-muted text-sm mt-1">For {site.name} HQ staff. Use your own phone number; we&apos;ll text you a code.</p>
      <div className="mt-6">
        <Suspense fallback={<div className="h-40" />}><Login searchParams={searchParams} /></Suspense>
      </div>
    </div>
  );
}

async function Login({ searchParams }: Pick<PageProps<"/ops/login">, "searchParams">) {
  if (await getHqStaff()) redirect("/ops/orders");
  const user = await getCurrentUser();
  if (user || (await searchParams).denied) {
    return (
      <div className="card p-5 text-sm">
        <p className="font-semibold">This number doesn&apos;t have HQ access.</p>
        <p className="mt-1 text-muted">Ask an HQ owner to add you on the Team page, then sign in again.</p>
        <form action={signOut} className="mt-4"><button className="btn-outline py-2">Use a different number</button></form>
      </div>
    );
  }
  return <OtpForm next="/ops/orders" />;
}
