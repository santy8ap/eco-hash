"use client";
import { useNetwork } from "@/lib/client/use-network";
import { formatCopCompact, formatHashrate, formatNumber, formatPct } from "@/lib/format";

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 px-5 py-4 sm:px-6">
      <dt className="cap">{label}</dt>
      <dd className="num mt-1.5 truncate text-[1.35rem] text-ink">{value}</dd>
      {note && <dd className="mt-0.5 truncate text-xs text-mute">{note}</dd>}
    </div>
  );
}

/** La red Bitcoin en cuatro cifras: precio, hashrate, dificultad y el próximo ajuste. */
export function NetworkStrip() {
  const { data } = useNetwork();
  const net = data?.network;
  const dash = "—";
  const tera = net ? net.difficulty / 1e12 : 0;
  return (
    <section aria-label="La red Bitcoin hoy" className="mx-auto max-w-[1200px] px-4 sm:px-8">
      <dl className="kpi-strip panel grid grid-cols-2 lg:grid-cols-4">
        <Stat label="Precio del BTC" value={data ? formatCopCompact(data.btc.cop) : dash} note={data ? `US$ ${formatNumber(data.btc.usd)}${data.btc.source === "referencia" ? ", referencia" : ""}` : undefined} />
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
