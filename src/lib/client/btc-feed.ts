"use client";
import { BTC_FEED_SUBSCRIBE, BTC_FEED_URL, nextTick, parseTickerPrice, type LiveTick } from "@/lib/btc-price";

/**
 * Una sola conexión al canal de precios de Coinbase para toda la página, compartida por todos los componentes que
 * muestran el precio del BTC. Publica como mucho un precio por segundo, se cierra con la pestaña oculta o cuando ya
 * nadie la usa, y si se cae o se queda callada vuelve a conectar con esperas crecientes (hasta un minuto). Sin
 * conexión no publica nada y los componentes usan el precio de /api/network.
 */

const THROTTLE_MS = 1000;
/** Tiempo sin precios para dar la conexión por perdida: BTC-USD tiene operaciones cada pocos segundos. */
const SILENCE_MS = 30_000;
/** Al cambiar de página los componentes se desmontan y se vuelven a montar: la conexión espera un poco antes de cerrarse. */
const IDLE_CLOSE_MS = 5000;
const MAX_RETRY_MS = 60_000;

let tick: LiveTick | null = null;
const listeners = new Set<() => void>();
let socket: WebSocket | null = null;
let failures = 0;
let pendingUsd: number | null = null;
let lastPublishAt = 0;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let silenceTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

function publish(next: LiveTick | null) {
  tick = next;
  for (const listener of listeners) listener();
}

function flush() {
  flushTimer = undefined;
  if (pendingUsd == null) return;
  const usd = pendingUsd;
  pendingUsd = null;
  if (tick?.usd === usd) return;
  lastPublishAt = Date.now();
  publish(nextTick(tick, usd, lastPublishAt));
}

function onPrice(usd: number) {
  pendingUsd = usd;
  if (!flushTimer) flushTimer = setTimeout(flush, Math.max(0, lastPublishAt + THROTTLE_MS - Date.now()));
}

function dropTick() {
  pendingUsd = null;
  clearTimeout(flushTimer);
  flushTimer = undefined;
  if (tick) publish(null);
}

/** Si no llegan precios en un rato, cierra la conexión: onclose la vuelve a abrir. */
function watchSilence(ws: WebSocket) {
  clearTimeout(silenceTimer);
  silenceTimer = setTimeout(() => ws.close(), SILENCE_MS);
}

const hidden = () => document.visibilityState === "hidden";

function connect() {
  if (socket || retryTimer || !listeners.size || hidden() || typeof WebSocket === "undefined") return;
  let ws: WebSocket;
  try {
    ws = new WebSocket(BTC_FEED_URL);
  } catch {
    retry();
    return;
  }
  socket = ws;
  watchSilence(ws);
  ws.onopen = () => ws.send(BTC_FEED_SUBSCRIBE);
  ws.onmessage = (event) => {
    const usd = parseTickerPrice(event.data);
    if (usd == null) return;
    failures = 0;
    watchSilence(ws);
    onPrice(usd);
  };
  ws.onerror = () => ws.close();
  ws.onclose = () => {
    if (socket !== ws) return;
    socket = null;
    clearTimeout(silenceTimer);
    dropTick();
    retry();
  };
}

function retry() {
  if (retryTimer || !listeners.size) return;
  const wait = Math.min(MAX_RETRY_MS, 2000 * 2 ** failures);
  failures += 1;
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    connect();
  }, wait);
}

function disconnect() {
  clearTimeout(retryTimer);
  retryTimer = undefined;
  clearTimeout(silenceTimer);
  const ws = socket;
  socket = null;
  if (ws) {
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    ws.close();
  }
  dropTick();
}

function onVisibilityChange() {
  if (hidden()) {
    disconnect();
  } else {
    failures = 0;
    connect();
  }
}

/** Para useSyncExternalStore: la primera suscripción abre la conexión y la última la cierra. */
export function subscribeBtcFeed(listener: () => void) {
  listeners.add(listener);
  clearTimeout(idleTimer);
  idleTimer = undefined;
  document.addEventListener("visibilitychange", onVisibilityChange);
  connect();
  return () => {
    listeners.delete(listener);
    if (listeners.size || idleTimer) return;
    idleTimer = setTimeout(() => {
      idleTimer = undefined;
      if (listeners.size) return;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      disconnect();
    }, IDLE_CLOSE_MS);
  };
}

export const getBtcTick = () => tick;
export const getServerBtcTick = (): LiveTick | null => null;
