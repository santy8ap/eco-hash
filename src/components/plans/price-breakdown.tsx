"use client";
import { useNetwork } from "@/lib/client/use-network";
import { formatBtc, formatCop, formatHashprice, formatPct, formatSats, formatTh } from "@/lib/format";
import { DAYS_PER_MONTH, estimateReturn, planEconomics } from "@/lib/mining/plan-math";

export interface PriceBreakdownProps {
  hashrateTh: number;
  months: number;
  priceCopPerThMonth: number;
  /** Hashprice de hoy: con él se estima el mes; el definitivo se fija al confirmarse el pago */
  satsPerThDay: number;
}

/** Lo que se paga y lo que se estima minar en el mes, con su valor al precio del BTC de hoy. */
export function PriceBreakdown({ hashrateTh, months, priceCopPerThMonth, satsPerThDay }: PriceBreakdownProps) {
  const econ = planEconomics({ hashrateTh, priceCopPerThMonth }, satsPerThDay, months);
  const { data } = useNetwork();
  const est = data ? estimateReturn(econ, data.btc.cop) : null;
  return (
    <section aria-label="Mensualidad y minería estimada" className="mt-7">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="panel min-w-0 p-5">
          <dt className="cap">Mensualidad</dt>
          <dd className="num mt-3 text-[1.7rem] leading-tight">{formatCop(econ.monthlyCop)}</dd>
          <dd className="num mt-2 text-sm text-mute">
            {formatTh(hashrateTh)} × {formatCop(priceCopPerThMonth)} por TH/s
          </dd>
          <dd className="mt-4 border-t border-line pt-3 text-sm text-fog">
            {months} meses: <span className="num text-ink">{formatCop(econ.totalCop)}</span> en total, pagados mes a mes.
          </dd>
        </div>
        <div className="panel min-w-0 p-5">
          <dt className="cap">Minería estimada del mes</dt>
          <dd className="num mt-3 text-[1.7rem] leading-tight">{formatSats(econ.monthlySats)}</dd>
          <dd className="num mt-2 text-sm text-mute">{formatBtc(econ.monthlySats)}</dd>
          <dd className="mt-4 border-t border-line pt-3 text-sm text-fog">
            {formatTh(hashrateTh)} × {formatHashprice(satsPerThDay)} × {DAYS_PER_MONTH} días.
          </dd>
        </div>
      </dl>
      {est && data && (
        <div className="panel mt-3 flex flex-wrap items-end justify-between gap-3 p-5">
          <div>
            <p className="cap">Al precio del BTC de hoy ({formatCop(data.btc.cop)})</p>
            <p className="num mt-2 text-xl">
              {formatCop(est.monthlyValueCop)} al mes{" "}
              <span className={est.profitPct >= 0 ? "text-jade-text" : "text-coral"}>
                ({est.profitPct >= 0 ? "+" : "−"}
                {formatPct(Math.abs(est.profitPct), 1)} sobre la mensualidad)
              </span>
            </p>
          </div>
          <p className="num text-sm text-mute">El mes se paga solo con el BTC por encima de {formatCop(est.breakEvenBtcCop)}</p>
        </div>
      )}
      <p className="mt-4 text-xs leading-relaxed text-mute">
        Estimación con el hashprice de hoy. El hashprice del mes se fija cuando se confirma tu pago, y el valor en pesos depende del precio del BTC: la
        rentabilidad no está garantizada. La mensualidad incluye la energía y el mantenimiento.
      </p>
    </section>
  );
}
