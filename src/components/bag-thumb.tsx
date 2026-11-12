import Image from "next/image";
import { site } from "@/lib/site";

export function BagThumb({ sizeKg, src }: { sizeKg: number; src?: string | null }) {
  return (
    <div className="relative h-20 w-20 shrink-0 rounded-xl bg-white border border-border">
      <Image src={src || site.productImage} alt="" fill sizes="80px" className="object-contain p-1.5" />
      <span className="absolute -bottom-1.5 -right-1.5 rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-bold text-white">{sizeKg}kg</span>
    </div>
  );
}
