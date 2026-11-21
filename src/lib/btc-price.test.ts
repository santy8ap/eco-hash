import { describe, expect, it } from "vitest";
import { BTC_FEED_SUBSCRIBE, BTC_FEED_URL, combineBtcPrice, nextTick, parseTickerPrice, type BtcSnapshot } from "@/lib/btc-price";

const ticker = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: "ticker",
    sequence: 12042642428,
    product_id: "BTC-USD",
    price: "58912.34",
    best_bid: "58912.33",
    best_ask: "58912.34",
    side: "buy",
    time: "2026-11-20T23:40:16.253563Z",
    trade_id: 82062566,
    last_size: "0.0042",
    ...over,
  });

describe("canal de precios de Coinbase", () => {
  it("se suscribe al ticker de BTC-USD del feed público", () => {
    expect(BTC_FEED_URL).toBe("wss://ws-feed.exchange.coinbase.com");
    expect(JSON.parse(BTC_FEED_SUBSCRIBE)).toEqual({ type: "subscribe", product_ids: ["BTC-USD"], channels: ["ticker"] });
  });

  it("lee el precio de cada operación (viene como texto)", () => {
    expect(parseTickerPrice(ticker())).toBe(58_912.34);
    expect(parseTickerPrice(ticker({ price: 60_000 }))).toBe(60_000);
  });

  it("ignora la confirmación de la suscripción, otros mercados, errores y mensajes dañados", () => {
    expect(parseTickerPrice(JSON.stringify({ type: "subscriptions", channels: [{ name: "ticker", product_ids: ["BTC-USD"] }] }))).toBeNull();
    expect(parseTickerPrice(ticker({ product_id: "ETH-USD" }))).toBeNull();
    expect(parseTickerPrice(JSON.stringify({ type: "error", message: "Failed to subscribe" }))).toBeNull();
    expect(parseTickerPrice("{no es json")).toBeNull();
    expect(parseTickerPrice(new ArrayBuffer(8))).toBeNull();
    for (const price of ["0", "-5", "abc", "", null, undefined, "Infinity"]) expect(parseTickerPrice(ticker({ price }))).toBeNull();
  });
});

describe("dirección del último cambio", () => {
  it("sube, baja o queda igual frente al último precio en vivo", () => {
    expect(nextTick(null, 58_000, 1)).toEqual({ usd: 58_000, at: 1, dir: 0 });
    expect(nextTick({ usd: 58_000, at: 1, dir: 0 }, 58_010, 2)).toEqual({ usd: 58_010, at: 2, dir: 1 });
    expect(nextTick({ usd: 58_010, at: 2, dir: 1 }, 57_990.5, 3)).toEqual({ usd: 57_990.5, at: 3, dir: -1 });
    expect(nextTick({ usd: 57_990.5, at: 3, dir: -1 }, 57_990.5, 4)).toEqual({ usd: 57_990.5, at: 4, dir: 0 });
  });
});

describe("precio que se muestra", () => {
  const coingecko: BtcSnapshot = { cop: 201_833_511, usd: 58_883, source: "coingecko", updatedAt: 1000 };
  const reference: BtcSnapshot = { cop: 200_000_000, usd: 58_000, source: "referencia", updatedAt: 1000 };

  it("sin precio de /api/network todavía no hay nada que mostrar, aunque Coinbase ya haya respondido", () => {
    expect(combineBtcPrice(null, null)).toBeNull();
    expect(combineBtcPrice(null, { usd: 59_000, at: 5, dir: 1 })).toBeNull();
    expect(combineBtcPrice({ ...coingecko, usd: 0 }, { usd: 59_000, at: 5, dir: 1 })).toBeNull();
  });

  it("mientras Coinbase conecta se usa el de CoinGecko, y el de referencia queda marcado", () => {
    expect(combineBtcPrice(coingecko, null)).toEqual({ cop: 201_833_511, usd: 58_883, live: false, reference: false, dir: 0, updatedAt: 1000 });
    expect(combineBtcPrice(reference, null)).toMatchObject({ cop: 200_000_000, live: false, reference: true });
  });

  it("en vivo: el dólar de Coinbase se pasa a pesos con la tasa implícita en el precio de CoinGecko", () => {
    const live = combineBtcPrice(coingecko, { usd: 59_000, at: 5000, dir: 1 })!;
    expect(live).toMatchObject({ usd: 59_000, live: true, reference: false, dir: 1, updatedAt: 5000 });
    expect(live.cop).toBeCloseTo(59_000 * (201_833_511 / 58_883), 6);
  });

  it("con la tasa de referencia el precio sigue siendo en vivo: lo que manda es el BTC, no el peso", () => {
    expect(combineBtcPrice(reference, { usd: 59_000, at: 5000, dir: -1 })).toMatchObject({ cop: 59_000 * (200_000_000 / 58_000), live: true, reference: false });
  });
});
