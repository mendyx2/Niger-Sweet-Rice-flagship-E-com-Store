"use client";

import { useSearchParams } from "next/navigation";
import { BagImage } from "@/components/bag-image";

/** Main product photo; follows the bag size chosen in the size picker (?size=). */
export function ProductPhoto({ variants }: { variants: { sizeKg: number; imageUrl: string | null }[] }) {
  const size = Number(useSearchParams().get("size"));
  const v = variants.find((x) => x.sizeKg === size) ?? variants[0];
  return <BagImage priority src={v?.imageUrl} sizeKg={v?.sizeKg} className="aspect-square border border-border" />;
}
