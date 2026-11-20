"use client";
import { useId, useMemo, useState } from "react";
import { formatCop, formatDay, formatNumber } from "@/lib/format";
import type { DayReturn } from "@/lib/mining/summary";

/** Ticks limpios para el eje Y: 0 y tres pasos redondos que cubren el máximo. */
function ticksFor(max: number) {
  if (max <= 0) return [0, 1];
  const raw = max / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  return [0, step, step * 2, step * 3];
}

const compact = (n: number) => (n >= 10_000 ? `${formatNumber(n / 1000, n >= 100_000 ? 0 : 1)} mil` : formatNumber(n));

/**
 * Sats minados por día, en columnas: el día más antiguo a la izquierda. El de hoy lleva textura porque todavía
 * está creciendo. Cada columna es su propio objetivo de puntero y de teclado, con su valor en el globo; la tabla
 * tiene las mismas cifras sin depender del puntero.
 */
export function SatsChart({ rows, btcCop }: { rows: DayReturn[]; btcCop: number | null }) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const days = useMemo(() => [...rows].reverse(), [rows]);
  const max = Math.max(1, ...days.map((d) => d.sats));
  const ticks = ticksFor(max);
  const top = ticks.at(-1)!;

  const W = 720;
  const H = 240;
  const pad = { l: 56, r: 8, t: 12, b: 28 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const band = plotW / Math.max(1, days.length);
  const barW = Math.max(3, Math.min(24, band - 2));
  const y = (v: number) => pad.t + plotH - (v / top) * plotH;
  const labelEvery = Math.max(1, Math.ceil(days.length / 7));
  const hovered = active != null ? days[active] : null;

  return (
    <div>
      <div className="flex justify-end">
        <button type="button" className="link text-sm text-fog" aria-pressed={table} onClick={() => setTable((t) => !t)}>
          {table ? "Ver la gráfica" : "Ver como tabla"}
        </button>
      </div>
      {table ? (
        <table className="mt-3 w-full text-sm">
          <caption className="sr-only">Sats minados por día</caption>
          <thead>
            <tr className="text-left text-mute">
              <th scope="col" className="py-2 font-normal">Día</th>
              <th scope="col" className="py-2 text-right font-normal">Sats</th>
              <th scope="col" className="py-2 text-right font-normal">Al precio de hoy</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.dayStart} className="border-t border-line">
                <th scope="row" className="py-2.5 text-left font-normal">{r.today ? "Hoy (en curso)" : formatDay(r.dayStart)}</th>
                <td className="num py-2.5 text-right">{formatNumber(r.sats, r.today ? 1 : 0)}</td>
                <td className="num py-2.5 text-right text-fog">{btcCop ? formatCop((r.sats * btcCop) / 1e8) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative mt-2">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-labelledby={`${id}-t`}>
            <title id={`${id}-t`}>
              {`Sats minados por día, últimos ${days.length} días. Máximo ${formatNumber(max)} sats.`}
            </title>
            <defs>
              <pattern id={`${id}-today`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="var(--color-chart)" opacity="0.45" />
                <rect width="2.5" height="6" fill="var(--color-chart)" />
              </pattern>
            </defs>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth="1" />
                <text x={pad.l - 10} y={y(t)} dy="0.32em" textAnchor="end" className="num fill-[var(--color-mute)] text-[11px]">
                  {compact(t)}
                </text>
              </g>
            ))}
            {days.map((d, i) => {
              const x = pad.l + i * band + (band - barW) / 2;
              const h = Math.max(d.sats > 0 ? 2 : 0, plotH - (y(d.sats) - pad.t));
              const r = Math.min(4, barW / 2, h);
              const yTop = pad.t + plotH - h;
              // Columna con la punta redondeada y la base recta.
              const path = h
                ? `M${x},${pad.t + plotH} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${pad.t + plotH} Z`
                : "";
              return (
                <g
                  key={d.dayStart}
                  tabIndex={0}
                  role="button"
                  aria-label={`${d.today ? "Hoy" : formatDay(d.dayStart)}: ${formatNumber(d.sats, d.today ? 1 : 0)} sats`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="outline-none"
                >
                  <rect x={pad.l + i * band} y={pad.t} width={band} height={plotH} fill="transparent" />
                  {path && (
                    <path
                      d={path}
                      fill={d.today ? `url(#${id}-today)` : active === i ? "var(--color-amber)" : "var(--color-chart)"}
                      className="transition-[fill] duration-150"
                    />
                  )}
                  {active === i && <rect x={pad.l + i * band + 1} y={pad.t} width={band - 2} height={plotH} fill="var(--color-ink)" opacity="0.04" />}
                  {(i % labelEvery === 0 || i === days.length - 1) && (
                    <text x={pad.l + i * band + band / 2} y={H - 8} textAnchor="middle" className="fill-[var(--color-mute)] text-[11px]">
                      {d.today ? "Hoy" : formatDay(d.dayStart)}
                    </text>
                  )}
                </g>
              );
            })}
            <line x1={pad.l} x2={W - pad.r} y1={pad.t + plotH} y2={pad.t + plotH} stroke="var(--color-line-strong)" strokeWidth="1" />
          </svg>
          {hovered && active != null && (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-[10px] border border-line-strong bg-raise px-3 py-2 text-sm shadow-[0_8px_24px_rgb(0_0_0/0.25)]"
              style={{ left: `${((pad.l + active * band + band / 2) / W) * 100}%` }}
              role="status"
            >
              <p className="num whitespace-nowrap text-base text-ink">{formatNumber(hovered.sats, hovered.today ? 1 : 0)} sats</p>
              <p className="whitespace-nowrap text-xs text-mute">
                {hovered.today ? "Hoy, todavía sumando" : formatDay(hovered.dayStart)}
                {btcCop ? `, ${formatCop((hovered.sats * btcCop) / 1e8)}` : ""}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
