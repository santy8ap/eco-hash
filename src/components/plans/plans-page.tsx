"use client";
import { PLAN_MONTHS } from "@/config/plans";
import { useCatalog } from "@/lib/client/use-catalog";
import { useBtcCop } from "@/lib/client/use-btc-price";
import { DAYS_PER_MONTH } from "@/lib/mining/plan-math";
import { formatHashprice, formatHashrate, formatPct } from "@/lib/format";
import { Topbar } from "@/components/panel/shell";
import { usePortfolio } from "@/components/panel/use-portfolio";
import { ErrorNote } from "@/components/ui/field";
import { PlanCatalog } from "./plan-catalog";
import { PlanRow } from "./plan-row";

/** Comprar un plan y pagar los meses de los planes que ya se tienen. */
export function PlansPage() {
  const { catalog, loaded, error, reload } = useCatalog();
  const btcCop = useBtcCop();
  const { data, now } = usePortfolio();
  const subs = data?.subscriptions ?? [];
  const payable = subs.filter((s) => ["activa", "en_pausa", "en_revision"].includes(s.state));
  const used = catalog.capacityTh > 0 ? catalog.contractedTh / catalog.capacityTh : 0;

  return (
    <>
      <Topbar title="Planes" subtitle={`Contratos de ${PLAN_MONTHS} meses, con un pago por cada mes de ${DAYS_PER_MONTH} días.`} />

      {payable.length > 0 && (
        <section className="mb-12" aria-labelledby="mis-planes">
          <h2 id="mis-planes" className="pb-4 text-xl font-semibold">
            Tus planes
          </h2>
          <ul className="grid gap-3">
            {payable.map((s) => (
              <PlanRow key={s.id} sub={s} now={now} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="comprar">
        <div className="flex flex-wrap items-end justify-between gap-4 pb-4">
          <h2 id="comprar" className="text-xl font-semibold">
            {payable.length ? "Comprar otro plan" : "Elige tu plan"}
          </h2>
          <p className="text-sm text-mute">
            Hashprice de hoy: <span className="num text-ink">{formatHashprice(catalog.satsPerThDay)}</span>. La granja tiene{" "}
            <span className="num text-ink">{formatHashrate(catalog.availableTh)}</span> libres ({formatPct(1 - used, 0)}).
          </p>
        </div>
        {error && !loaded ? (
          <>
            <ErrorNote>{error}</ErrorNote>
            <button type="button" onClick={() => void reload()} className="btn btn-ghost mt-5">
              Volver a cargar
            </button>
          </>
        ) : (
          <PlanCatalog catalog={catalog} btcCop={btcCop} />
        )}
      </section>
    </>
  );
}
