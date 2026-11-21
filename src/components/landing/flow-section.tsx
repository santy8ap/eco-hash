"use client";
import { FARM } from "@/config/farm";
import { PLANS } from "@/config/plans";
import { useCatalog } from "@/lib/client/use-catalog";
import { useNetwork } from "@/lib/client/use-network";
import { formatHashrate, formatNumber, formatPct, formatSats } from "@/lib/format";
import { MIN_WITHDRAWAL_SATS } from "@/lib/withdrawal-schema";

/** Cuánto baja el agua en cada parada (px): el salto hasta las turbinas y luego el tramo plano de lo digital. */
const DROPS = [0, 28, 56, 56, 56];

/**
 * La granja contada como el recorrido del agua: del río a las turbinas, a los mineros, a la red Bitcoin y a tu panel.
 * Cada parada tiene una cifra de hoy: la capacidad y el hashprice salen del catálogo; la parte de la granja en la
 * red, del hashrate de mempool.space.
 */
export function FlowSection() {
  const { catalog } = useCatalog();
  const { data } = useNetwork();
  const miners = Math.round(catalog.capacityTh / FARM.minerTh);
  const powerKw = (catalog.capacityTh * FARM.efficiencyJTh) / 1000;
  const networkTh = data ? data.network.hashrateEh * 1e6 : null;
  const share = networkTh ? catalog.capacityTh / networkTh : null;
  const used = catalog.capacityTh > 0 ? catalog.contractedTh / catalog.capacityTh : 0;
  const starter = PLANS[0];

  const stations = [
    {
      name: "El río",
      figure: "De pasada",
      text: "La central toma agua del río y la devuelve aguas abajo, sin represa. El agua no para, ni de día ni de noche.",
    },
    {
      name: "La casa de máquinas",
      figure: `${formatNumber(powerKw)} kW`,
      text: "Las turbinas convierten la caída del agua en electricidad. Es lo que consumen los mineros a plena capacidad.",
    },
    {
      name: "Los contenedores",
      figure: `${formatNumber(miners)} mineros`,
      text: `ASIC de ${formatNumber(FARM.minerTh)} TH/s que gastan ${FARM.efficiencyJTh} J por cada TH: ${formatHashrate(catalog.capacityTh)} en total. Hoy hay ${formatHashrate(catalog.contractedTh)} contratados (${formatPct(used, 0)}).`,
      gauge: used,
    },
    {
      name: "La red Bitcoin",
      figure: share != null ? formatPct(share, 4) : "—",
      text: `Es la parte de la granja en todo el hashrate de Bitcoin${networkTh ? `, que hoy es de ${formatHashrate(networkTh)}` : ""}. Lo que mina se reparte entre quienes alquilan su hashrate.`,
    },
    {
      name: "Tu panel",
      figure: `${formatNumber(catalog.satsPerThDay)} sats`,
      text: `por cada TH/s al día, el hashprice de este mes. Con ${formatNumber(starter.hashrateTh)} TH/s son ${formatSats(starter.hashrateTh * catalog.satsPerThDay)} diarios, que retiras a tu billetera desde ${formatSats(MIN_WITHDRAWAL_SATS)}.`,
    },
  ];

  return (
    <section id="granja" aria-labelledby="granja-titulo" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 sm:px-8">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,46ch)] lg:items-end">
        <h2 id="granja-titulo" className="shout text-[clamp(2.8rem,6.4vw,4.8rem)]">
          Del río a tu billetera
        </h2>
        <p className="leading-relaxed text-fog">
          {catalog.farmName} está en {catalog.location}. Así se convierte el agua en sats, con las cifras de hoy.
        </p>
      </div>

      <div className="flow relative mt-14">
        <svg className="flow-line hidden lg:block" viewBox="0 0 1000 80" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M0 8 C 110 8, 90 36, 200 36 C 310 36, 290 64, 400 64 L 1000 64"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <ol className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-5">
          {stations.map((s, i) => (
            <li key={s.name} className="flow-station" style={{ "--drop": `${DROPS[i]}px` } as React.CSSProperties}>
              <h3 className="text-[0.95rem] font-medium text-fog">{s.name}</h3>
              <p className="shout mt-2 text-[clamp(2.1rem,3.2vw,2.6rem)] text-ink">{s.figure}</p>
              {s.gauge != null && (
                <div className="capacity-gauge mt-3 max-w-[14rem]" role="img" aria-label={`Capacidad contratada: ${formatPct(s.gauge, 0)}`}>
                  <span style={{ width: `${Math.min(100, Math.max(s.gauge > 0 ? 2 : 0, s.gauge * 100))}%` }} />
                </div>
              )}
              <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-mute">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
