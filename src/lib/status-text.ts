import type { OrderStatus } from "@prisma/client";

export const STATUS_SMS: Partial<Record<OrderStatus, string>> = {
  PROCESSING: "is being prepared.",
  READY_FOR_PICKUP: "is ready for pickup at our flagship store.",
  OUT_FOR_DELIVERY: "is on its way to you.",
  DELIVERED: "has been delivered. Thank you! Any problem with a bag? Report it within 48 hours for a free replacement.",
  FAILED_DELIVERY: "could not be delivered. We will call you to rearrange.",
  CANCELLED: "has been cancelled.",
};

/** Allowed status changes from the staff screen. */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["CANCELLED"],
  PAID: ["PROCESSING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "CANCELLED"],
  PROCESSING: ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "CANCELLED"],
  READY_FOR_PICKUP: ["DELIVERED", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED_DELIVERY"],
  FAILED_DELIVERY: ["OUT_FOR_DELIVERY", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};
