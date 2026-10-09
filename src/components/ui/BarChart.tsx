"use client";

import React, { useId, useState } from "react";

export interface BarPoint {
  key: string;
  /** X-axis label ("Fri 9"). */
  label: string;
  value: number;
  /** Tooltip heading (defaults to the label). */
  title?: string;
  /** Extra tooltip / table lines ("5 trips", "Tips $12.00"). */
  details?: string[];
  /** Accent colour (e.g. today). */
  highlight?: boolean;
}

interface BarChartProps {
  data: BarPoint[];
  /** Value formatter for tooltips, the y axis and the table fallback. */
  formatValue: (v: number) => string;
  /** Compact formatter for the y axis ticks (defaults to formatValue). */
  formatTick?: (v: number) => string;
  /** Describes the chart for assistive tech and the fallback table caption. */
  ariaLabel: string;
  valueHeader?: string;
  height?: number;
  className?: string;
}

/** Rounds the axis maximum up to a "nice" number so the ticks read 0 / 25 / 50 / 75 / 100 style. */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

/**
 * Lightweight bar chart (inline SVG bars + HTML labels, no chart library). Every bar is a focusable control: hover, focus or
 * tap shows a tooltip, and a visually hidden table carries the same numbers for screen readers.
 */
export const BarChart: React.FC<BarChartProps> = ({ data, formatValue, formatTick, ariaLabel, valueHeader = "Value", height = 200, className = "" }) => {
  const [active, setActive] = useState<number | null>(null);
  const uid = useId();
  const n = data.length;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => f * max);
  const fmtTick = formatTick ?? formatValue;
  const slot = n > 0 ? 100 / n : 100;

  return (
    <div className={className}>
      <div className="flex gap-2 pt-9 sm:gap-3" style={{ ["--chart-h" as string]: `${height}px` }}>
        <div aria-hidden="true" className="flex w-11 shrink-0 flex-col justify-between text-right text-xs tabular-nums text-slate-600 dark:text-slate-300 sm:w-14" style={{ height }}>
          {ticks.map((t, i) => (
            <span key={i} className="-my-2 leading-4">
              {fmtTick(t)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true" focusable="false">
              {ticks.map((_, i) => (
                <line key={i} x1="0" x2="100" y1={i * 25} y2={i * 25} className="stroke-slate-200 dark:stroke-[#331A3B]" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray={i === 4 ? undefined : "3 4"} />
              ))}
              {data.map((d, i) => {
                const h = d.value > 0 ? Math.max((d.value / max) * 100, 1.5) : 0.8;
                const isActive = active === i;
                const fill =
                  d.value <= 0
                    ? "fill-slate-300 dark:fill-[#4B2757]"
                    : d.highlight
                      ? "fill-[#189578] dark:fill-[#4FD2B2]"
                      : isActive
                        ? "fill-[#521A44] dark:fill-[#E9BFDF]"
                        : "fill-[#7A2B66] dark:fill-[#C76DB3]";
                return <rect key={d.key} x={i * slot + slot * 0.16} width={slot * 0.68} y={100 - h} height={h} className={`${fill} transition-colors`} />;
              })}
            </svg>
            <div className="absolute inset-0 flex" role="group" aria-label={ariaLabel}>
              {data.map((d, i) => {
                const h = d.value > 0 ? Math.max((d.value / max) * 100, 1.5) : 0.8;
                const align = i <= 1 && n > 5 ? "left-0" : i >= n - 2 && n > 5 ? "right-0" : "left-1/2 -translate-x-1/2";
                return (
                  <button
                    key={d.key}
                    type="button"
                    aria-label={`${d.title ?? d.label}: ${formatValue(d.value)}${d.details?.length ? `, ${d.details.join(", ")}` : ""}`}
                    aria-describedby={active === i ? `${uid}-tip` : undefined}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive((a) => (a === i ? null : a))}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive((a) => (a === i ? null : a))}
                    onClick={() => setActive((a) => (a === i ? null : i))}
                    data-compact
                    className="relative h-full min-h-0 flex-1 cursor-pointer rounded-sm focus-visible:outline-2"
                  >
                    {active === i && (
                      <span
                        id={`${uid}-tip`}
                        role="tooltip"
                        className={`pointer-events-none absolute z-10 w-max max-w-[14rem] rounded-lg border border-[#E9BFDF] bg-white px-3 py-2 text-left text-xs shadow-lg dark:border-[#521A44] dark:bg-[#28162E] ${align}`}
                        style={{ bottom: `calc(${h}% + 8px)` }}
                      >
                        <span className="block font-bold text-slate-900 dark:text-white">{d.title ?? d.label}</span>
                        <span className="block text-sm font-extrabold tabular-nums text-[#7A2B66] dark:text-[#E9BFDF]">{formatValue(d.value)}</span>
                        {d.details?.map((line) => (
                          <span key={line} className="block text-slate-600 dark:text-slate-300">
                            {line}
                          </span>
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div aria-hidden="true" className="mt-2 flex">
            {data.map((d, i) => (
              <span key={d.key} className={`min-w-0 flex-1 text-center text-xs tabular-nums text-slate-600 dark:text-slate-300 ${i % 2 === 1 ? "max-sm:invisible" : ""} ${d.highlight ? "font-bold text-[#14755F] dark:text-[#4FD2B2]" : ""}`}>
                <span className="inline-block whitespace-nowrap">{d.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">{valueHeader}</th>
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.title ?? d.label}</th>
              <td>{formatValue(d.value)}</td>
              <td>{d.details?.join(", ") ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
