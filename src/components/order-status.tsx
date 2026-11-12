import type { OrderStatus } from "@prisma/client";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  PROCESSING: "Being prepared",
  READY_FOR_PICKUP: "Ready for pickup",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  FAILED_DELIVERY: "Delivery attempt failed",
  CANCELLED: "Cancelled",
};

const TONE: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "bg-cta/30 text-brand-strong",
  PAID: "bg-brand-soft text-brand",
  PROCESSING: "bg-brand-soft text-brand",
  READY_FOR_PICKUP: "bg-brand text-white",
  OUT_FOR_DELIVERY: "bg-brand text-white",
  DELIVERED: "bg-success/15 text-success",
  FAILED_DELIVERY: "bg-promo-soft text-danger",
  CANCELLED: "bg-border text-muted",
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}
