import type { Metadata } from "next";
import { TrackForm } from "./track-form";

export const metadata: Metadata = {
  title: "Track your rice delivery",
  description: "Track your order with your order number and phone number.",
  alternates: { canonical: "/track" },
};

export default function TrackPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="font-display text-4xl font-bold">Track your order</h1>
      <p className="mt-2 text-muted">Enter the order number from your SMS and the phone number you ordered with.</p>
      <TrackForm />
    </div>
  );
}
