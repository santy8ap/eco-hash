"use client";
import { PLAN_MONTHS } from "@/config/plans";
import { useCatalog } from "@/lib/client/use-catalog";
import { useNetwork } from "@/lib/client/use-network";
import { formatHashprice } from "@/lib/format";
import { ErrorNote } from "@/components/ui/field";
import { PlanCatalog } from "@/components/plans/plan-catalog";

/** Los planes, con sus precios vigentes y el hashprice de hoy. Para comprar hay que ingresar. */
export function PlansSection() {
  const { catalog, loaded, error, reload } = useCatalog();
  const { data } = useNetwork();
  const btcCop = data?.btc.cop ?? null;
  return (
    <section id="planes" aria-labelledby="planes-titulo" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 sm:px-8">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[1fr_minmax(0,46ch)] lg:items-end">
        <h2 id="planes-titulo" className="display text-[clamp(2.1rem,4.6vw,3.25rem)]">
          Elige cuánto hashrate quieres
        </h2>
        <p className="leading-relaxed text-fog">
          Contrato de {PLAN_MONTHS} meses que pagas mes a mes. Cada mes mina con el hashprice vigente el día en que se confirma tu pago; hoy es{" "}
          <span className="num text-ink">{formatHashprice(catalog.satsPerThDay)}</span>.
        </p>
      </div>

      {error && !loaded && (
        <div className="mt-8">
          <ErrorNote>No pudimos cargar los precios vigentes.</ErrorNote>
          <button type="button" onClick={() => void reload()} className="btn btn-ghost mt-4">
            Volver a cargar
          </button>
        </div>
      )}

      <div className="mt-10">
        <PlanCatalog catalog={catalog} btcCop={btcCop} />
      </div>
    </section>
  );
}
