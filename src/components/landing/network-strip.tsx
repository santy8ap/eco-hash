"use client";
import { useBtcPrice } from "@/lib/client/use-btc-price";
import { useNetwork } from "@/lib/client/use-network";
import { formatHashrate, formatNumber, formatPct } from "@/lib/format";
import { LivePrice, LivePriceNote } from "@/components/ui/live-price";

function Stat({ label, value, note, size = "text-[1.35rem]" }: { label: string; value: React.ReactNode; note?: React.ReactNode; size?: string }) {
  return (
    <div className="min-w-0 px-5 py-4 sm:px-6">
      <dt className="cap">{label}</dt>
      <dd className={`num mt-1.5 truncate text-ink ${size}`}>{value}</dd>
      {note && <dd className="mt-0.5 truncate text-xs text-mute">{note}</dd>}
    </div>
  );
}

/** La red Bitcoin en cuatro cifras: el precio en vivo, el hashrate, la dificultad y el próximo ajuste. */
export function NetworkStrip() {
  const { data } = useNetwork();
  const btc = useBtcPrice();
  const net = data?.network;
  const dash = "—";
  const tera = net ? net.difficulty / 1e12 : 0;
  return (
    <section aria-label="La red Bitcoin hoy" className="mx-auto max-w-[1200px] px-4 sm:px-8">
      <dl className="kpi-strip panel grid grid-cols-2 lg:grid-cols-4">
        {/* El precio completo cambia con cada operación; en el celular la cifra se achica para caber en media fila. */}
        <Stat
          label="Precio del BTC"
          value={btc ? <LivePrice price={btc} /> : dash}
          size="text-[clamp(1.05rem,4.2vw,1.35rem)]"
          note={btc ? <LivePriceNote price={btc} /> : undefined}
        />
        <Stat label="Hashrate de la red" value={net ? formatHashrate(net.hashrateEh * 1e6) : dash} note={net ? "promedio de 3 días" : undefined} />
        <Stat label="Dificultad" value={net ? `${formatNumber(tera, 1)} T` : dash} note={net ? "en billones de hashes" : undefined} />
        <Stat
          label="Próximo ajuste"
          value={net ? (net.adjustment.changePct ? `${net.adjustment.changePct > 0 ? "+" : "−"}${formatPct(Math.abs(net.adjustment.changePct) / 100, 2)}` : "sin estimar") : dash}
          note={net ? `en ${formatNumber(net.adjustment.remainingBlocks)} bloques` : undefined}
        />
      </dl>
    </section>
  );
}
