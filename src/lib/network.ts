import "server-only";

/**
 * Datos públicos de la red Bitcoin (mempool.space): la altura del último bloque, el hashrate de la red, el próximo
 * ajuste de dificultad y el hashprice de la red. Si mempool.space no responde, se usan valores de referencia,
 * rotulados como tales: la página nunca se queda sin datos, pero tampoco presenta un estimado como medición.
 */

export interface NetworkStats {
  height: number;
  /** Cuándo se minó el último bloque (ms UTC); null con valores de referencia */
  lastBlockAt: number | null;
  /** Hash del último bloque (empieza con ceros: la prueba de trabajo); null con valores de referencia */
  lastBlockHash: string | null;
  /** Hashrate de la red (EH/s) */
  hashrateEh: number;
  difficulty: number;
  adjustment: {
    /** Avance del periodo de 2.016 bloques (0 a 100) */
    progressPct: number;
    remainingBlocks: number;
    /** Cambio estimado de la dificultad (%) */
    changePct: number;
    /** Cuándo se estima el ajuste (ms UTC) */
    etaMs: number;
  };
  /** Lo que mina 1 TH/s en un día con el hashrate y las comisiones de hoy (sats) */
  networkHashpriceSats: number;
  source: "mempool" | "referencia";
  updatedAt: number;
}

const BLOCKS_PER_DAY = 144;
const SUBSIDY_BTC = 3.125;
/** Comisiones promedio por bloque cuando no se conocen las reales (BTC) */
const DEFAULT_FEES_BTC = 0.025;
const BLOCK_MS = 600_000;
const RETARGET_BLOCKS = 2016;

/** Sats que mina 1 TH/s en un día: la recompensa de 144 bloques repartida entre el hashrate de la red. */
export function networkHashpriceSats(hashrateHs: number, subsidyBtc = SUBSIDY_BTC, feesBtcPerBlock = DEFAULT_FEES_BTC) {
  const networkTh = hashrateHs / 1e12;
  if (!(networkTh > 0)) return 0;
  return (BLOCKS_PER_DAY * (subsidyBtc + feesBtcPerBlock) * 100_000_000) / networkTh;
}

/** Referencia tomada de mempool.space: el bloque 976.796, minado el 20 de noviembre de 2026 a las 23:27 UTC, con 1,04 ZH/s. */
const REF = { height: 976_796, at: Date.UTC(2026, 10, 20, 23, 27, 7), hashrateHs: 1.04e21 };

function referenceStats(now: number): NetworkStats {
  const height = REF.height + Math.floor((now - REF.at) / BLOCK_MS);
  const inPeriod = ((height % RETARGET_BLOCKS) + RETARGET_BLOCKS) % RETARGET_BLOCKS;
  const remainingBlocks = RETARGET_BLOCKS - inPeriod;
  return {
    height,
    lastBlockAt: null,
    lastBlockHash: null,
    hashrateEh: REF.hashrateHs / 1e18,
    difficulty: (REF.hashrateHs * BLOCK_MS) / 1000 / 2 ** 32,
    adjustment: { progressPct: (inPeriod / RETARGET_BLOCKS) * 100, remainingBlocks, changePct: 0, etaMs: now + remainingBlocks * BLOCK_MS },
    networkHashpriceSats: networkHashpriceSats(REF.hashrateHs),
    source: "referencia",
    updatedAt: now,
  };
}

function apiBase() {
  return (process.env.MEMPOOL_API_BASE?.trim() || "https://mempool.space/api").replace(/\/$/, "");
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, { signal: AbortSignal.timeout(2500), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`mempool.space ${res.status}`);
  return (await res.json()) as T;
}

interface MempoolBlock {
  id?: string;
  height: number;
  timestamp: number;
  extras?: { totalFees?: number };
}

async function fetchStats(now: number): Promise<NetworkStats> {
  const [blocks, hashrate, adjustment] = await Promise.all([
    getJson<MempoolBlock[]>("/v1/blocks"),
    getJson<{ currentHashrate: number; currentDifficulty: number }>("/v1/mining/hashrate/3d"),
    getJson<{ progressPercent: number; difficultyChange: number; remainingBlocks: number; estimatedRetargetDate: number }>("/v1/difficulty-adjustment"),
  ]);
  const tip = blocks[0];
  if (!tip || !Number.isFinite(tip.height) || !(hashrate.currentHashrate > 0)) throw new Error("mempool.space: respuesta incompleta");
  const fees = blocks.map((b) => b.extras?.totalFees).filter((f): f is number => typeof f === "number" && f >= 0);
  const feesBtc = fees.length ? fees.reduce((s, f) => s + f, 0) / fees.length / 100_000_000 : DEFAULT_FEES_BTC;
  return {
    height: tip.height,
    lastBlockAt: tip.timestamp * 1000,
    lastBlockHash: typeof tip.id === "string" && /^[0-9a-f]{64}$/.test(tip.id) ? tip.id : null,
    hashrateEh: hashrate.currentHashrate / 1e18,
    difficulty: hashrate.currentDifficulty,
    adjustment: {
      progressPct: adjustment.progressPercent,
      remainingBlocks: adjustment.remainingBlocks,
      changePct: adjustment.difficultyChange,
      etaMs: adjustment.estimatedRetargetDate,
    },
    networkHashpriceSats: networkHashpriceSats(hashrate.currentHashrate, SUBSIDY_BTC, feesBtc),
    source: "mempool",
    updatedAt: now,
  };
}

let cache: { at: number; ttl: number; data: NetworkStats } | null = null;

/** Datos de la red con 60 s de caché (30 s si mempool.space no respondió). */
export async function getNetworkStats(): Promise<NetworkStats> {
  const now = Date.now();
  if (cache && now - cache.at < cache.ttl) return cache.data.source === "referencia" ? referenceStats(now) : cache.data;
  try {
    const data = await fetchStats(now);
    cache = { at: now, ttl: 60_000, data };
    return data;
  } catch {
    const data = referenceStats(now);
    cache = { at: now, ttl: 30_000, data };
    return data;
  }
}
