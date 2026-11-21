"use client";
import { useBtcPrice } from "@/lib/client/use-btc-price";
import { useNetwork } from "@/lib/client/use-network";
import { formatHashrate, formatNumber, formatPct } from "@/lib/format";
import { LivePrice, LivePriceNote } from "@/components/ui/live-price";

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-4 sm:px-8">
      <dt className="cap">{label}</dt>
      <dd className="num mt-1 truncate text-[clamp(1.1rem,2.2vw,1.45rem)] font-medium text-ink">{value}</dd>
      {note && <dd className="mt-0.5 truncate text-xs text-mute">{note}</dd>}
    </div>
  );
}

/** La red Bitcoin en cuatro lecturas, como la leyenda del dibujo: el precio en vivo, el hashrate, la dificultad y el próximo ajuste. */
export function NetworkStrip() {
  const { data } = useNetwork();
  const btc = useBtcPrice();
  const net = data?.network;
  const dash = "—";
  const tera = net ? net.difficulty / 1e12 : 0;
  return (
    <section aria-label="La red Bitcoin hoy" className="strip">
      <dl className="mx-auto grid max-w-[1200px] grid-cols-2 lg:grid-cols-4">
        <Stat label="Precio del BTC" value={btc ? <LivePrice price={btc} /> : dash} note={btc ? <LivePriceNote price={btc} /> : undefined} />
        <Stat label="Hashrate de la red" value={net ? formatHashrate(net.hashrateEh * 1e6) : dash} note={net ? "promedio de 3 días" : undefined} />
        <Stat label="Dificultad" value={net ? `${formatNumber(tera, 1)} billones` : dash} note={net ? "se ajusta cada 2.016 bloques" : undefined} />
        <Stat
          label="Próximo ajuste"
          value={net ? (net.adjustment.changePct ? `${net.adjustment.changePct > 0 ? "+" : "−"}${formatPct(Math.abs(net.adjustment.changePct) / 100, 2)}` : "sin estimar") : dash}
          note={net ? `en ${formatNumber(net.adjustment.remainingBlocks)} bloques` : undefined}
        />
      </dl>
    </section>
  );
}
