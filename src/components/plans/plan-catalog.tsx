"use client";
import Link from "next/link";
import type { CatalogDTO } from "@/lib/client/use-catalog";
import { formatCop, formatNumber, formatPct, formatTh } from "@/lib/format";
import { estimateReturn } from "@/lib/mining/plan-math";
import { planCheckoutHref } from "@/lib/navigation";

/**
 * Los planes en filas, para el inicio y el panel: la barra muestra cuánto hashrate es cada uno frente al más
 * grande, con la mensualidad, los sats estimados del mes y su valor al precio del BTC de hoy.
 */
export function PlanCatalog({ catalog, btcCop }: { catalog: CatalogDTO; btcCop: number | null }) {
  const biggest = Math.max(...catalog.plans.map((p) => p.hashrateTh));
  return (
    <>
      <ul className="grid gap-3">
        {catalog.plans.map((plan) => {
          const est = btcCop ? estimateReturn(plan, btcCop) : null;
          return (
            <li
              key={plan.id}
              className="panel grid grid-cols-[minmax(0,1fr)] items-center gap-x-8 gap-y-4 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.75fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto]"
            >
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-lg font-semibold">Plan {plan.name}</h3>
                  <p className="num text-lg text-amber-text">{formatTh(plan.hashrateTh)}</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-seam" aria-hidden="true">
                  <span className="plan-bar block h-full rounded-full" style={{ width: `${(plan.hashrateTh / biggest) * 100}%` }} />
                </div>
              </div>
              <div>
                <p className="cap">Mensualidad</p>
                <p className="num mt-1 text-[1.05rem] text-ink">{formatCop(plan.monthlyCop)}</p>
              </div>
              <div>
                <p className="cap">Minería estimada al mes</p>
                <p className="num mt-1 text-[1.05rem] text-ink">{formatNumber(plan.monthlySats)} sats</p>
              </div>
              <div>
                <p className="cap">Al precio del BTC de hoy</p>
                <p className="num mt-1 text-[1.05rem] text-ink">{est ? formatCop(est.monthlyValueCop) : "—"}</p>
                {est && (
                  <p className={`num text-xs ${est.profitPct >= 0 ? "text-jade-text" : "text-coral"}`}>
                    {est.profitPct >= 0 ? "+" : "−"}
                    {formatPct(Math.abs(est.profitPct), 1)} sobre la mensualidad
                  </p>
                )}
              </div>
              {plan.available ? (
                <Link href={planCheckoutHref(plan.id)} className="btn btn-solid w-full lg:w-auto">
                  Elegir {plan.name}
                </Link>
              ) : (
                <span className="btn btn-ghost w-full lg:w-auto" aria-disabled="true">
                  Sin capacidad
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-5 max-w-[80ch] text-sm leading-relaxed text-mute">
        Son estimaciones: los sats dependen del hashprice de cada mes y su valor en pesos, del precio del BTC, que cambia todos los días. La mensualidad
        incluye la energía y el mantenimiento de los mineros.
      </p>
    </>
  );
}
