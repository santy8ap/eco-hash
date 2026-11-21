/**
 * El precio del BTC en tiempo real. El navegador escucha cada operación de BTC-USD en el canal público de Coinbase
 * (sin cuenta ni llave) y la pasa a pesos con la tasa implícita en el precio de /api/network (CoinGecko). Mientras
 * Coinbase conecta, o si no responde, se usa el precio de /api/network, que se renueva cada minuto. Isomórfico y
 * sin dependencias: lo usan el cliente y las pruebas.
 */

export const BTC_FEED_URL = "wss://ws-feed.exchange.coinbase.com";
const PRODUCT = "BTC-USD";
/** Coinbase cierra la conexión si no recibe la suscripción en los primeros segundos. */
export const BTC_FEED_SUBSCRIBE = JSON.stringify({ type: "subscribe", product_ids: [PRODUCT], channels: ["ticker"] });

/** El precio en dólares de un mensaje del canal, o null si no es una operación de BTC-USD con un precio válido. */
export function parseTickerPrice(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!msg || typeof msg !== "object") return null;
  const { type, product_id, price } = msg as { type?: unknown; product_id?: unknown; price?: unknown };
  if (type !== "ticker" || product_id !== PRODUCT) return null;
  if (typeof price !== "string" && typeof price !== "number") return null;
  const usd = typeof price === "string" && !price.trim() ? NaN : Number(price);
  return Number.isFinite(usd) && usd > 0 ? usd : null;
}

/** El último precio en vivo, con la dirección del cambio para el destello de la cifra. */
export interface LiveTick {
  usd: number;
  /** Hora de este dispositivo en que llegó (ms) */
  at: number;
  /** 1 subió, -1 bajó, 0 igual (o el primero) */
  dir: -1 | 0 | 1;
}

export function nextTick(prev: LiveTick | null, usd: number, at: number): LiveTick {
  const dir = !prev || usd === prev.usd ? 0 : usd > prev.usd ? 1 : -1;
  return { usd, at, dir };
}

/** El precio del BTC que devuelve /api/network. */
export interface BtcSnapshot {
  cop: number;
  usd: number;
  source: "coingecko" | "referencia";
  updatedAt: number;
}

export interface BtcPrice {
  cop: number;
  usd: number;
  /** true si viene de Coinbase, operación por operación */
  live: boolean;
  /** true solo con el precio de referencia (sin CoinGecko ni Coinbase): no sirve para estimar en pesos */
  reference: boolean;
  dir: -1 | 0 | 1;
  updatedAt: number;
}

/**
 * El precio que se muestra. En vivo, el dólar de Coinbase se pasa a pesos con la tasa de CoinGecko; si CoinGecko no
 * respondió, con la de referencia, que se mueve mucho menos que el BTC. Sin el precio de /api/network no hay tasa,
 * así que no se muestra nada hasta que llegue.
 */
export function combineBtcPrice(snapshot: BtcSnapshot | null, tick: LiveTick | null): BtcPrice | null {
  if (!snapshot || !(snapshot.cop > 0) || !(snapshot.usd > 0)) return null;
  if (!tick) {
    return { cop: snapshot.cop, usd: snapshot.usd, live: false, reference: snapshot.source === "referencia", dir: 0, updatedAt: snapshot.updatedAt };
  }
  return { cop: tick.usd * (snapshot.cop / snapshot.usd), usd: tick.usd, live: true, reference: false, dir: tick.dir, updatedAt: tick.at };
}
