import Image from "next/image";
import { site } from "@/lib/site";

/**
 * Product photo with a size tag. We currently have one photo (5kg bag); it is
 * reused for every size with a clear size label until each bag is photographed.
 */
export function BagImage({
  sizeKg,
  priority = false,
  className = "",
  sizes = "(min-width: 768px) 40vw, 90vw",
}: {
  sizeKg?: number;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-3xl bg-white ${className}`}>
      <Image
        src={site.productImage}
        alt={`${site.name}${sizeKg ? ` ${sizeKg}kg bag` : " bag"}`}
        fill
        priority={priority}
        sizes={sizes}
        className="object-contain p-[6%]"
      />
      {sizeKg != null && (
        <span className="absolute left-3 top-3 rounded-full bg-brand px-3 py-1 text-sm font-bold text-white shadow">
          {sizeKg}kg
        </span>
      )}
    </div>
  );
}
