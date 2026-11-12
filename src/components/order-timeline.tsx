import type { OrderStatus } from "@prisma/client";
import { CheckIcon } from "./icons";

type Ev = { status: OrderStatus; createdAt: Date; note?: string | null };

const fmt = (d: Date) =>
  d.toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });

/** Visual progress: Placed → Paid → Preparing → On the way / Ready → Delivered. */
export function OrderTimeline({ status, events, isPickup }: { status: OrderStatus; events: Ev[]; isPickup: boolean }) {
  if (status === "CANCELLED") {
    return <p className="rounded-xl bg-background p-4 text-muted">This order was cancelled. {events.at(-1)?.note ?? ""}</p>;
  }
  const steps: { key: OrderStatus[]; label: string }[] = [
    { key: ["PENDING_PAYMENT"], label: "Order placed" },
    { key: ["PAID"], label: "Payment received" },
    { key: ["PROCESSING"], label: "Being prepared" },
    isPickup
      ? { key: ["READY_FOR_PICKUP"], label: "Ready for pickup" }
      : { key: ["OUT_FOR_DELIVERY", "FAILED_DELIVERY"], label: "Out for delivery" },
    { key: ["DELIVERED"], label: isPickup ? "Collected" : "Delivered" },
  ];
  const order: OrderStatus[] = ["PENDING_PAYMENT", "PAID", "PROCESSING", isPickup ? "READY_FOR_PICKUP" : "OUT_FOR_DELIVERY", "DELIVERED"];
  const normalized = status === "FAILED_DELIVERY" ? "OUT_FOR_DELIVERY" : status;
  const currentIdx = order.indexOf(normalized);

  return (
    <ol className="relative space-y-6">
      {steps.map((s, i) => {
        const done = i <= currentIdx;
        const current = i === currentIdx;
        const ev = [...events].reverse().find((e) => s.key.includes(e.status));
        return (
          <li key={s.label} className="relative flex gap-4">
            {i < steps.length - 1 && (
              <span className={`absolute left-[15px] top-8 h-[calc(100%-4px)] w-0.5 ${i < currentIdx ? "bg-brand" : "bg-border"}`} aria-hidden="true" />
            )}
            <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
              done ? "border-brand bg-brand text-white" : "border-border bg-surface text-muted"} ${current ? "ring-4 ring-cta/50" : ""}`}>
              {done ? <CheckIcon className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
            </span>
            <div className="pt-1">
              <p className={`font-semibold ${done ? "" : "text-muted"}`}>
                {s.label}
                {current && status === "FAILED_DELIVERY" && <span className="ml-2 text-sm font-medium text-danger">Delivery attempt failed; we&apos;ll call you</span>}
              </p>
              {ev && done && <p className="text-sm text-muted">{fmt(ev.createdAt)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
