"use client";
import { FARM } from "@/config/farm";
import { useCatalog } from "@/lib/client/use-catalog";
import { formatHashrate, formatNumber, formatPct } from "@/lib/format";

/**
 * La granja como un mapa de capacidad: cada celda es un minero de 200 TH/s, agrupados en contenedores de 30
 * (dos filas de 15, como un contenedor de mineros).
 * Las celdas ámbar ya están contratadas; las vacías están disponibles. Es la capacidad real del catálogo, no
 * una telemetría de las máquinas.
 */
function FarmMap({ capacityTh, contractedTh }: { capacityTh: number; contractedTh: number }) {
  const miners = Math.max(1, Math.round(capacityTh / FARM.minerTh));
  const sold = Math.min(miners, Math.ceil(contractedTh / FARM.minerTh - 1e-9));
  const perContainer = 30;
  const containers = Math.ceil(miners / perContainer);
  return (
    <figure className="min-w-0">
      <div className="farm-map grid gap-2.5" role="img" aria-label={`Mapa de capacidad: ${sold} de ${miners} mineros contratados`}>
        {Array.from({ length: containers }, (_, c) => (
          <div key={c} className="farm-container">
            {Array.from({ length: Math.min(perContainer, miners - c * perContainer) }, (_, i) => {
              const n = c * perContainer + i;
              return <span key={i} className="farm-cell" data-sold={n < sold ? "" : undefined} />;
            })}
          </div>
        ))}
      </div>
      <figcaption className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-mute">
        <span className="flex items-center gap-2">
          <span className="farm-cell" data-sold="" aria-hidden="true" /> Contratado
        </span>
        <span className="flex items-center gap-2">
          <span className="farm-cell" aria-hidden="true" /> Disponible
        </span>
        <span>Cada celda es un minero de {formatNumber(FARM.minerTh)} TH/s.</span>
      </figcaption>
    </figure>
  );
}

export function FarmSection() {
  const { catalog } = useCatalog();
  const used = catalog.capacityTh > 0 ? catalog.contractedTh / catalog.capacityTh : 0;
  return (
    <section id="granja" aria-labelledby="granja-titulo" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 sm:px-8">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <div>
          <h2 id="granja-titulo" className="display text-[clamp(2.1rem,4.6vw,3.25rem)]">
            <span className="whitespace-nowrap">{catalog.farmName}</span>, junto al río
          </h2>
          <p className="mt-5 max-w-[56ch] leading-relaxed text-fog">
            Mineros ASIC en contenedores, en {catalog.location}. La energía sale de una central hidroeléctrica de pasada: el agua del río mueve las
            turbinas y las turbinas mueven los mineros, de día y de noche.
          </p>
          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-line bg-line">
            {[
              ["Capacidad", formatHashrate(catalog.capacityTh)],
              ["Contratado", `${formatHashrate(catalog.contractedTh)} (${formatPct(used, 0)})`],
              ["Eficiencia", `${FARM.efficiencyJTh} J/TH`],
              ["Energía", FARM.energy],
            ].map(([label, value]) => (
              <div key={label} className="bg-raise px-4 py-3.5">
                <dt className="cap">{label}</dt>
                <dd className="mt-1 text-[0.98rem] text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <FarmMap capacityTh={catalog.capacityTh} contractedTh={catalog.contractedTh} />
      </div>
    </section>
  );
}
