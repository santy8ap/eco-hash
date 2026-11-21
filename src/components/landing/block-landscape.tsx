"use client";
import { useMemo } from "react";
import { useNetwork } from "@/lib/client/use-network";
import { useNow } from "@/lib/client/use-now";
import { formatNumber } from "@/lib/format";
import { LANDSCAPE_COLS, LANDSCAPE_ROWS, buildLandscape, riverRows } from "@/lib/landscape";
import { OutboundLink } from "@/components/ui/outbound-link";

const CELL_W = 10;
const LINE_H = 15;
const W = LANDSCAPE_COLS * CELL_W;
const RIVER_TOP = LANDSCAPE_ROWS * LINE_H + 8;
const H = RIVER_TOP + 2 * LINE_H;
const NBSP = " ";

/** «hace 3 min 12 s» */
function ago(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  if (m >= 60) return `hace ${Math.floor(m / 60)} h ${m % 60} min`;
  return m ? `hace ${m} min ${s % 60} s` : `hace ${s} s`;
}

/** El hash del último bloque, si mempool.space respondió. Con valores de referencia no hay hash que mostrar. */
function useBlock() {
  const { data } = useNetwork();
  const net = data?.network ?? null;
  const live = net?.source === "mempool";
  return { net, live, hash: live ? (net?.lastBlockHash ?? null) : null };
}

/** Cada fila es de 144 caracteres exactos: con textLength, las columnas quedan alineadas en cualquier pantalla. */
function Row({ text, y, width = W }: { text: string; y: number; width?: number }) {
  return (
    <text x={0} y={y} textLength={width} lengthAdjust="spacing">
      {text.replaceAll(" ", NBSP)}
    </text>
  );
}

/**
 * Las montañas de San Carlos tejidas con el hash del último bloque, y el río de ceros que corre abajo. Es decorativo
 * (aria-hidden): la leyenda del bloque, en el héroe, dice en texto qué bloque es, cuándo se minó y su hash completo.
 */
export function BlockArt() {
  const { hash } = useBlock();
  const { layers } = useMemo(() => buildLandscape(hash), [hash]);
  const river = useMemo(() => riverRows(), []);
  return (
    <div className="landscape" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
        {/* Con cada bloque nuevo, los caracteres se renuevan con un fundido corto. */}
        <g key={hash ?? "sin-hash"} className="ridges">
          {layers.map((rows, layer) => (
            <g key={layer} className={`ridge-${layer}`}>
              {rows.map((row, r) => (row.trim() ? <Row key={r} text={row} y={(r + 1) * LINE_H} /> : null))}
            </g>
          ))}
        </g>
        <g className="river">
          {river.map((row, i) => (
            // La fila va dos veces seguida para que el corrimiento empalme sin salto.
            <g key={i} className={i ? "river-flow river-flow-slow" : "river-flow"} style={{ "--river-from": `-${W}px` } as React.CSSProperties}>
              <Row text={row + row} y={RIVER_TOP + (i + 1) * LINE_H} width={2 * W} />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

function BlockHash({ hash }: { hash: string }) {
  const zeros = hash.match(/^0*/)?.[0].length ?? 0;
  return (
    <p className="hash mt-3 text-[0.92rem] leading-[1.5] lg:text-[0.72rem] xl:text-[0.8rem]">
      <span className="block-hash-zeros">{hash.slice(0, zeros)}</span>
      <span className="text-ink">{hash.slice(zeros)}</span>
    </p>
  );
}

/** La leyenda del dibujo: qué bloque es, cuándo se minó, su hash y el enlace para verlo en mempool.space. */
export function BlockCaption() {
  const { net, live, hash } = useBlock();
  const now = useNow(1000);
  return (
    <section aria-label="Red Bitcoin en este momento" className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-x-6">
        <p className="flex items-center gap-2.5 text-sm text-fog">
          <span className="live-dot" data-tone={!net ? "off" : live ? undefined : "wait"} />
          {!net ? "Conectando con la red Bitcoin…" : live ? "Red Bitcoin en vivo" : "Red Bitcoin (valores de referencia)"}
        </p>
        {live && net && (
          <OutboundLink href={`https://mempool.space/block/${net.lastBlockHash ?? net.height}`} className="link inline-flex min-h-11 items-center text-sm text-fog">
            Ver en mempool.space
          </OutboundLink>
        )}
      </div>
      <p className="shout mt-1 text-[clamp(2.4rem,4.4vw,3.4rem)]">
        Bloque <span className="tabular-nums">{net ? formatNumber(net.height) : "—"}</span>
      </p>
      <p className="num mt-1 text-sm text-fog" aria-live="off">
        {net?.lastBlockAt && now ? `minado ${ago(now - net.lastBlockAt)}` : net ? "altura estimada" : " "}
      </p>
      {hash && <BlockHash hash={hash} />}
      <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-mute">
        {hash
          ? "La cordillera de abajo está tejida con este hash y el río, con los ceros con que empieza todo hash válido. Cambia con cada bloque nuevo, más o menos cada 10 minutos."
          : "El hash del bloque aparece cuando hay conexión con mempool.space."}
      </p>
    </section>
  );
}
