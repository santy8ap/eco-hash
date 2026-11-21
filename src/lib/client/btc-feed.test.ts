import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BTC_FEED_SUBSCRIBE, BTC_FEED_URL } from "@/lib/btc-price";

/** Un WebSocket de mentira: la prueba decide cuándo abre, qué precios llegan y cuándo se cae. */
class FakeSocket {
  static all: FakeSocket[] = [];
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.();
  }
  open() {
    this.onopen?.();
  }
  price(usd: number) {
    this.onmessage?.({ data: JSON.stringify({ type: "ticker", product_id: "BTC-USD", price: usd.toFixed(2) }) });
  }
}

const doc = {
  visibilityState: "visible" as "visible" | "hidden",
  handlers: new Set<() => void>(),
  addEventListener(_type: string, fn: () => void) {
    this.handlers.add(fn);
  },
  removeEventListener(_type: string, fn: () => void) {
    this.handlers.delete(fn);
  },
  setVisibility(state: "visible" | "hidden") {
    this.visibilityState = state;
    for (const fn of this.handlers) fn();
  },
};

let feed: typeof import("./btc-feed");
const last = () => FakeSocket.all.at(-1)!;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(1_795_000_000_000);
  FakeSocket.all = [];
  doc.visibilityState = "visible";
  doc.handlers.clear();
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal("document", doc);
  vi.resetModules();
  feed = await import("./btc-feed");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("canal del precio del BTC en vivo", () => {
  it("una sola conexión para toda la página, que se suscribe al abrir y publica como mucho un precio por segundo", async () => {
    const a = vi.fn();
    const b = vi.fn();
    feed.subscribeBtcFeed(a);
    feed.subscribeBtcFeed(b);
    expect(FakeSocket.all).toHaveLength(1);
    expect(last().url).toBe(BTC_FEED_URL);
    last().open();
    expect(last().sent).toEqual([BTC_FEED_SUBSCRIBE]);

    last().price(58_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(feed.getBtcTick()).toMatchObject({ usd: 58_000, dir: 0 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    // Tres operaciones en menos de un segundo: se publica solo la última, cuando se cumple el segundo.
    last().price(58_010);
    await vi.advanceTimersByTimeAsync(300);
    last().price(58_020.5);
    await vi.advanceTimersByTimeAsync(300);
    expect(feed.getBtcTick()?.usd).toBe(58_000);
    await vi.advanceTimersByTimeAsync(400);
    expect(feed.getBtcTick()).toMatchObject({ usd: 58_020.5, dir: 1 });
    expect(a).toHaveBeenCalledTimes(2);

    last().price(57_990);
    await vi.advanceTimersByTimeAsync(1000);
    expect(feed.getBtcTick()).toMatchObject({ usd: 57_990, dir: -1 });
    // El mismo precio otra vez no vuelve a pintar la página.
    last().price(57_990);
    await vi.advanceTimersByTimeAsync(1000);
    expect(a).toHaveBeenCalledTimes(3);
    expect(feed.getServerBtcTick()).toBeNull();
  });

  it("si se cae, deja de mostrar el precio en vivo y vuelve a conectar con esperas crecientes", async () => {
    feed.subscribeBtcFeed(() => {});
    last().open();
    last().price(58_000);
    await vi.advanceTimersByTimeAsync(0);
    last().close();
    expect(feed.getBtcTick()).toBeNull();

    expect(FakeSocket.all).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(FakeSocket.all).toHaveLength(2);
    last().close();
    await vi.advanceTimersByTimeAsync(2000);
    expect(FakeSocket.all).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(FakeSocket.all).toHaveLength(3);
    // Al volver los precios, la espera vuelve a empezar desde 2 s.
    last().open();
    last().price(58_100);
    await vi.advanceTimersByTimeAsync(0);
    expect(feed.getBtcTick()?.usd).toBe(58_100);
    last().close();
    await vi.advanceTimersByTimeAsync(2000);
    expect(FakeSocket.all).toHaveLength(4);
  });

  it("una conexión que se queda callada 30 s se cierra y se reabre", async () => {
    feed.subscribeBtcFeed(() => {});
    last().open();
    last().price(58_000);
    await vi.advanceTimersByTimeAsync(29_000);
    expect(last().closed).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSocket.all[0].closed).toBe(true);
    expect(feed.getBtcTick()).toBeNull();
    await vi.advanceTimersByTimeAsync(2000);
    expect(FakeSocket.all).toHaveLength(2);
  });

  it("con la pestaña oculta se cierra; al volver, reconecta enseguida", async () => {
    feed.subscribeBtcFeed(() => {});
    last().open();
    last().price(58_000);
    await vi.advanceTimersByTimeAsync(0);
    doc.setVisibility("hidden");
    expect(FakeSocket.all[0].closed).toBe(true);
    expect(feed.getBtcTick()).toBeNull();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(FakeSocket.all).toHaveLength(1);
    doc.setVisibility("visible");
    expect(FakeSocket.all).toHaveLength(2);
  });

  it("cuando nadie la usa se cierra a los 5 s; si un componente vuelve antes, sigue la misma conexión", async () => {
    const stopA = feed.subscribeBtcFeed(() => {});
    last().open();
    stopA();
    await vi.advanceTimersByTimeAsync(4000);
    const stopB = feed.subscribeBtcFeed(() => {});
    expect(FakeSocket.all).toHaveLength(1);
    expect(last().closed).toBe(false);
    stopB();
    await vi.advanceTimersByTimeAsync(5000);
    expect(last().closed).toBe(true);
    expect(doc.handlers.size).toBe(0);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(FakeSocket.all).toHaveLength(1);
  });
});
