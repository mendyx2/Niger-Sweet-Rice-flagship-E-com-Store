import Link from "next/link";
import { Suspense } from "react";

export default function NoAccess({ searchParams }: PageProps<"/partner/no-access">) {
  return (
    <div className="mx-auto max-w-md card p-8 text-center">
      <Suspense fallback={null}><Message searchParams={searchParams} /></Suspense>
      <Link href="/" className="btn-outline mt-6">Back to the shop</Link>
    </div>
  );
}

async function Message({ searchParams }: Pick<PageProps<"/partner/no-access">, "searchParams">) {
  const suspended = (await searchParams).suspended === "1";
  return (
    <>
      <h1 className="font-display text-2xl font-bold">{suspended ? "Your distributor account is paused" : "This number isn't linked to a distributor"}</h1>
      <p className="mt-2 text-muted">
        {suspended ? "Please contact Naija Sweet Rice HQ." : "The partner portal is for Naija Sweet Rice distributors. If you're a distributor, ask HQ to add your phone number."}
      </p>
    </>
  );
}
