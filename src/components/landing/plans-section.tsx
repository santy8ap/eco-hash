"use client";
import Link from "next/link";
import { PLAN_MONTHS } from "@/config/plans";
import { useBtcCop } from "@/lib/client/use-btc-price";
import { useCatalog } from "@/lib/client/use-catalog";
import { formatCop, formatHashprice, formatNumber, formatPct } from "@/lib/format";
import { estimateReturn } from "@/lib/mining/plan-math";
import { planCheckoutHref } from "@/lib/navigation";
import { ErrorNote } from "@/components/ui/field";

/**
 * Los planes como un tarifario: el hashrate en grande a la izquierda, lo que se paga y lo que mina en el medio, y el
 * botón al final. Los valores en pesos se estiman con el precio del BTC en vivo; con el de referencia, no se estima.
 */
export function PlansSection() {
  const { catalog, loaded, error, reload } = useCatalog();
  const btcCop = useBtcCop();
  return (
    <section id="planes" aria-labelledby="planes-titulo" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 sm:px-8">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,46ch)] lg:items-end">
        <h2 id="planes-titulo" className="shout text-[clamp(2.8rem,6.4vw,4.8rem)]">
          Elige cuánto hashrate quieres
        </h2>
        <p className="leading-relaxed text-fog">
          Contrato de {PLAN_MONTHS} meses que pagas mes a mes. Cada mes mina con el hashprice vigente el día en que se confirma tu pago; hoy es{" "}
          <span className="num text-ink">{formatHashprice(catalog.satsPerThDay)}</span>.
        </p>
      </div>

      {error && !loaded ? (
        <div className="mt-10">
          <ErrorNote>No pudimos cargar los precios vigentes.</ErrorNote>
          <button type="button" onClick={() => void reload()} className="btn btn-ghost mt-4">
            Volver a cargar
          </button>
        </div>
      ) : (
        <ul className="tariff mt-12">
          {catalog.plans.map((plan) => {
            const est = btcCop ? estimateReturn(plan, btcCop) : null;
            return (
              <li
                key={plan.id}
                className="grid grid-cols-[minmax(0,1fr)] items-center gap-x-8 gap-y-4 py-6 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,2.2fr)_auto]"
              >
                <div className="flex items-baseline justify-between gap-6 lg:block">
                  <h3 className="text-[0.95rem] font-medium text-fog">Plan {plan.name}</h3>
                  <p className="shout text-[clamp(2.6rem,5vw,3.6rem)] text-ink">
                    {formatNumber(plan.hashrateTh)} <span className="text-[0.5em] font-semibold text-fog">TH/s</span>
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:col-span-2 sm:row-start-2 sm:grid-cols-3 lg:col-span-1 lg:row-start-auto">
                  <div>
                    <dt className="cap">Mensualidad</dt>
                    <dd className="num mt-0.5 text-[1.15rem] text-ink">{formatCop(plan.monthlyCop)}</dd>
                  </div>
                  <div>
                    <dt className="cap">Mina al mes</dt>
                    <dd className="num mt-0.5 text-[1.15rem] text-ink">{formatNumber(plan.monthlySats)} sats</dd>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="cap">Al precio del BTC de hoy</dt>
                    <dd className="num mt-0.5 text-[1.15rem] text-ink">{est ? formatCop(est.monthlyValueCop) : "—"}</dd>
                    {est && (
                      <dd className={`num text-xs ${est.profitPct >= 0 ? "text-jade-text" : "text-coral"}`}>
                        {est.profitPct >= 0 ? "+" : "−"}
                        {formatPct(Math.abs(est.profitPct), 1)} sobre la mensualidad
                      </dd>
                    )}
                  </div>
                </dl>
                <div className="sm:col-start-2 sm:row-start-1 lg:col-start-3">
                  {plan.available ? (
                    <Link href={planCheckoutHref(plan.id)} className="btn btn-solid w-full sm:w-auto">
                      Elegir {plan.name}
                    </Link>
                  ) : (
                    <span className="btn btn-ghost w-full sm:w-auto" aria-disabled="true">
                      Sin capacidad
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-6 max-w-[80ch] text-sm leading-relaxed text-mute">
        Son estimaciones: los sats dependen del hashprice de cada mes y su valor en pesos, del precio del BTC, que cambia todo el tiempo. La mensualidad incluye
        la energía y el mantenimiento de los mineros.
      </p>
    </section>
  );
}
