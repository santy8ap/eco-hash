"use client";
import { useEffect, useState } from "react";
import { PLANS } from "@/config/plans";
import { useCatalog } from "@/lib/client/use-catalog";
import { useNetwork } from "@/lib/client/use-network";
import { useNow } from "@/lib/client/use-now";
import { formatNumber, formatTh } from "@/lib/format";

const HEX = "0123456789abcdef";
const STARTER = PLANS[0];

/** «hace 3 min 12 s» */
function ago(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  if (m >= 60) return `hace ${Math.floor(m / 60)} h ${m % 60} min`;
  return m ? `hace ${m} min ${s % 60} s` : `hace ${s} s`;
}

/** «en 8 días», «en 14 h» */
function eta(ms: number) {
  const h = Math.max(0, ms) / 3_600_000;
  return h >= 36 ? `en ${Math.round(h / 24)} días` : `en ${Math.max(1, Math.round(h))} h`;
}

/**
 * El hash aparece «resolviéndose» una sola vez: los dígitos giran y se asientan de izquierda a derecha, como un
 * minero que prueba nonces hasta dar con un hash que empieza con ceros. Sin movimiento si así lo pide el sistema.
 */
function useResolvingHash(hash: string | null) {
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    if (!hash) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const frame = requestAnimationFrame(() => setShown(hash));
      return () => cancelAnimationFrame(frame);
    }
    const started = performance.now();
    const total = 1100;
    let frame = 0;
    const step = (t: number) => {
      const settled = Math.floor(((t - started) / total) * hash.length);
      if (settled >= hash.length) return setShown(hash);
      let out = hash.slice(0, settled);
      for (let i = settled; i < hash.length; i++) out += HEX[Math.floor(Math.random() * 16)];
      setShown(out);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [hash]);
  return shown;
}

/** Milisegundos desde que el componente apareció en pantalla, renovados cada `everyMs`. */
function useSinceMount(everyMs: number) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => setElapsed(performance.now() - start), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return elapsed;
}

function BlockHash({ hash }: { hash: string }) {
  const zeros = hash.match(/^0*/)?.[0].length ?? 0;
  return (
    <p className="hash block-hash text-[0.95rem] leading-[1.55] sm:text-[1.02rem]">
      <span className="block-hash-zeros">{hash.slice(0, zeros)}</span>
      <span className="text-ink">{hash.slice(zeros)}</span>
    </p>
  );
}

export function BlockReadout() {
  const { data } = useNetwork();
  const { catalog } = useCatalog();
  const now = useNow(1000);
  const sinceOpen = useSinceMount(200);
  const net = data?.network;
  const shownHash = useResolvingHash(net?.lastBlockHash ?? null);
  const live = net?.source === "mempool";
  const starterSats = (STARTER.hashrateTh * catalog.satsPerThDay * sinceOpen) / 86_400_000;

  return (
    <section className="block-readout panel relative overflow-hidden p-5 sm:p-7" aria-label="Red Bitcoin en este momento">
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-2.5 text-sm text-fog">
          <span className="live-dot" data-tone={!net ? "off" : live ? undefined : "wait"} />
          {!net ? "Conectando con la red Bitcoin…" : live ? "Red Bitcoin en vivo" : "Red Bitcoin (valores de referencia)"}
        </p>
        {live && (
          <a href={`https://mempool.space/block/${net.lastBlockHash ?? net.height}`} target="_blank" rel="noreferrer" className="link text-xs text-mute">
            Ver en mempool.space
          </a>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="cap">Último bloque</p>
          <p className="figure mt-2 text-[clamp(2.6rem,6vw,3.6rem)] text-amber-text">{net ? formatNumber(net.height) : "—"}</p>
        </div>
        <p className="num pb-1.5 text-sm text-fog" aria-live="off">
          {net?.lastBlockAt && now ? ago(now - net.lastBlockAt) : net ? "altura estimada" : " "}
        </p>
      </div>

      <div className="mt-5 min-h-[3.2rem]">
        {shownHash ? (
          <BlockHash hash={shownHash} />
        ) : (
          <>
            <p className="hash block-hash text-[0.95rem] leading-[1.55] sm:text-[1.02rem]" aria-hidden="true">
              <span className="block-hash-zeros">{"0".repeat(19)}</span>
            </p>
            {net && !live && <p className="mt-1 text-xs text-dim">El hash del bloque aparece cuando hay conexión con mempool.space.</p>}
          </>
        )}
        <p className="mt-2 text-xs leading-relaxed text-mute">
          Un bloque es válido cuando su hash empieza con suficientes ceros. Encontrarlo exige probar billones de combinaciones: eso es minar.
        </p>
      </div>

      {net && (
        <div className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
            <span className="text-fog">Próximo ajuste de dificultad</span>
            <span className="num text-ink">
              {formatNumber(net.adjustment.remainingBlocks)} bloques, {now ? eta(net.adjustment.etaMs - now) : ""}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-seam" role="progressbar" aria-label="Avance hacia el próximo ajuste de dificultad" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(net.adjustment.progressPct)}>
            <span className="block h-full rounded-full bg-amber" style={{ width: `${Math.min(100, Math.max(0, net.adjustment.progressPct))}%` }} />
          </div>
        </div>
      )}

      <div className="tile mt-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3.5">
        <p className="text-sm text-fog">
          Un plan {STARTER.name} ({formatTh(STARTER.hashrateTh)}) minó desde que abriste esta página
        </p>
        <p className="figure text-xl text-ink" aria-live="off">
          {formatNumber(starterSats, 3)} <span className="unit text-sm text-mute">sats</span>
        </p>
      </div>
    </section>
  );
}
