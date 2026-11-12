import Image from "next/image";
import { site } from "@/lib/site";

/** Product photo for a bag size, with a size tag. Falls back to the default bag photo. */
export function BagImage({
  src,
  sizeKg,
  priority = false,
  className = "",
  sizes = "(min-width: 768px) 40vw, 90vw",
}: {
  src?: string | null;
  sizeKg?: number;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-3xl bg-white ${className}`}>
      <Image
        src={src || site.productImage}
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
