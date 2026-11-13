import { site } from "@/lib/site";

/** Wordmark with a small rice-grain mark in the bag's green and yellow. */
export function Logo({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill={onDark ? "#f8d906" : "#1d4d2d"} />
        <ellipse cx="12" cy="17" rx="3" ry="7" transform="rotate(-20 12 17)" fill={onDark ? "#1d4d2d" : "#f8d906"} />
        <ellipse cx="20" cy="15" rx="3" ry="7" transform="rotate(20 20 15)" fill={onDark ? "#1d4d2d" : "#fbf8f1"} />
      </svg>
      <span className={`font-display text-base min-[400px]:text-lg sm:text-xl font-bold leading-none whitespace-nowrap ${onDark ? "text-white" : "text-brand"}`}>
        {site.name}
      </span>
    </span>
  );
}
