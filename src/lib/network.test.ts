import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let network: typeof import("@/lib/network");
const NOW = Date.UTC(2026, 10, 20, 18, 0);

const FIXTURES: Record<string, unknown> = {
  "/v1/blocks": [
    { id: "00000000000000000001a6f3c2be7d4598e0c1f2a3b4c5d6e7f8091a2b3c4d5e", height: 974_120, timestamp: NOW / 1000 - 240, extras: { totalFees: 2_000_000 } },
    { height: 974_119, timestamp: NOW / 1000 - 900, extras: { totalFees: 3_000_000 } },
  ],
  "/v1/mining/hashrate/3d": { currentHashrate: 1.2e21, currentDifficulty: 1.6e14 },
  "/v1/difficulty-adjustment": { progressPercent: 41.5, difficultyChange: 2.75, remainingBlocks: 1180, estimatedRetargetDate: NOW + 8 * 86_400_000 },
};

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  network = await import("@/lib/network");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("hashprice de la red", () => {
  it("reparte la recompensa de 144 bloques al día entre el hashrate de la red", () => {
    // 144 × (3,125 + 0,025) BTC = 453,6 BTC al día entre 1,2 ZH/s (1.200 millones de TH/s): 37,8 sats por TH/s.
    expect(network.networkHashpriceSats(1.2e21)).toBeCloseTo(37.8, 6);
    expect(network.networkHashpriceSats(1.2e21, 3.125, 0)).toBeCloseTo(37.5, 6);
    expect(network.networkHashpriceSats(0)).toBe(0);
  });
});

describe("datos de la red Bitcoin", () => {
  it("con mempool.space responde con la altura, el hashrate, el ajuste de dificultad y el hashprice con las comisiones reales", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      urls.push(url.href);
      const body = FIXTURES[url.pathname.replace(/^\/api/, "")];
      return body ? Response.json(body) : new Response("no", { status: 404 });
    });
    const n = await network.getNetworkStats();
    expect(urls.every((u) => u.startsWith("https://mempool.space/api/"))).toBe(true);
    expect(n).toMatchObject({ source: "mempool", height: 974_120, lastBlockAt: NOW - 240_000, lastBlockHash: "00000000000000000001a6f3c2be7d4598e0c1f2a3b4c5d6e7f8091a2b3c4d5e", hashrateEh: 1200, difficulty: 1.6e14 });
    expect(n.adjustment).toEqual({ progressPct: 41.5, remainingBlocks: 1180, changePct: 2.75, etaMs: NOW + 8 * 86_400_000 });
    // Comisiones promedio de los últimos bloques: 0,025 BTC.
    expect(n.networkHashpriceSats).toBeCloseTo(37.8, 6);
  });

  it("respeta MEMPOOL_API_BASE y guarda la respuesta un minuto", async () => {
    vi.stubEnv("MEMPOOL_API_BASE", "http://localhost:4020/mempool/");
    let calls = 0;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      calls++;
      const url = new URL(String(input));
      expect(url.href.startsWith("http://localhost:4020/mempool/v1/")).toBe(true);
      return Response.json(FIXTURES[url.pathname.replace(/^\/mempool/, "")]);
    });
    await network.getNetworkStats();
    const first = calls;
    await network.getNetworkStats();
    expect(calls).toBe(first);
    vi.setSystemTime(NOW + 61_000);
    await network.getNetworkStats();
    expect(calls).toBe(first * 2);
  });

  it("si mempool.space no responde, usa valores de referencia rotulados y una altura estimada por el tiempo", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("sin red");
    });
    const n = await network.getNetworkStats();
    expect(n.source).toBe("referencia");
    // Sin datos reales no se inventa un hash.
    expect(n.lastBlockHash).toBeNull();
    expect(n.height).toBeGreaterThan(900_000);
    expect(n.adjustment.remainingBlocks).toBeGreaterThanOrEqual(1);
    expect(n.adjustment.remainingBlocks).toBeLessThanOrEqual(2016);
    expect(n.networkHashpriceSats).toBeGreaterThan(20);
    // Una hora después, la referencia avanza unos 6 bloques.
    vi.setSystemTime(NOW + 3_600_000 + 31_000);
    expect((await network.getNetworkStats()).height).toBe(n.height + 6);
  });
});
