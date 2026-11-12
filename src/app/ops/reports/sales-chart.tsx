"use client";

import { useState } from "react";
import { formatNaira } from "@/lib/money";

/**
 * Daily sales bar chart: one series in the validated chart green, thin bars
 * with 2px gaps and 4px rounded tops on the baseline, recessive grid, and a
 * hover/focus tooltip per bar. The same numbers are in the table below.
 */
const CHART = "#2f8a4f";
const W = 720, H = 220, PAD_L = 56, PAD_B = 24, PAD_T = 12;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v)!;
}
const short = (kobo: number) => {
  const n = kobo / 100;
  return n >= 1e6 ? `₦${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}m` : n >= 1e3 ? `₦${Math.round(n / 1e3)}k` : `₦${n}`;
};
const dayLabel = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "UTC" });

export function SalesChart({ days }: { days: { day: string; salesKobo: number; orders: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...days.map((d) => d.salesKobo)));
  const plotW = W - PAD_L, plotH = H - PAD_B - PAD_T;
  const slot = plotW / days.length;
  const barW = Math.max(2, slot - 2);
  const y = (v: number) => PAD_T + plotH - (v / max) * plotH;
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const labelEvery = Math.ceil(days.length / 8);
  const h = hover != null ? days[hover] : null;

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Sales per day">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD_L - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--muted)">{short(t)}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = PAD_L + i * slot + 1;
          const top = y(d.salesKobo);
          const hgt = PAD_T + plotH - top;
          const r = Math.min(4, barW / 2, hgt);
          return (
            <g key={d.day}>
              {d.salesKobo > 0 && (
                <path
                  d={`M${x},${PAD_T + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${PAD_T + plotH} Z`}
                  fill={CHART}
                  opacity={hover == null || hover === i ? 1 : 0.55}
                />
              )}
              {/* Hit target: the whole column, bigger than the bar */}
              <rect
                x={PAD_L + i * slot} y={PAD_T} width={slot} height={plotH} fill="transparent"
                tabIndex={0} aria-label={`${dayLabel(d.day)}: ${formatNaira(d.salesKobo)}, ${d.orders} orders`}
                onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                className="outline-none focus-visible:stroke-[var(--brand)]"
              />
              {i % labelEvery === 0 && (
                <text x={PAD_L + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">{dayLabel(d.day)}</text>
              )}
            </g>
          );
        })}
      </svg>
      {h && hover != null && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-lg"
          style={{ left: `clamp(0px, calc(${((PAD_L + hover * slot + slot / 2) / W) * 100}% - 70px), calc(100% - 140px))` }}
        >
          <strong className="block tabular-nums">{formatNaira(h.salesKobo)}</strong>
          <span className="text-muted">{dayLabel(h.day)} · {h.orders} order{h.orders === 1 ? "" : "s"}</span>
        </div>
      )}
    </figure>
  );
}
