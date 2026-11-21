import { expect, test, type WebSocketRoute } from "@playwright/test";

const HASH = "00000000000000000001a6f3c2be7d4598e0c1f2a3b4c5d6e7f8091a2b3c4d5e";

function network(source: "mempool" | "referencia", btcSource: "coingecko" | "referencia" = "coingecko") {
  const now = Date.now();
  return {
    network: {
      height: 974_120,
      lastBlockAt: source === "mempool" ? now - 194_000 : null,
      lastBlockHash: source === "mempool" ? HASH : null,
      hashrateEh: 1182.4,
      difficulty: 1.574e14,
      adjustment: { progressPct: 41.5, remainingBlocks: 1180, changePct: 2.75, etaMs: now + 8 * 86_400_000 },
      networkHashpriceSats: 38.4,
      source,
      updatedAt: now,
    },
    // 4.000 pesos por dólar: así las cuentas del precio en vivo dan cifras redondas.
    btc: { cop: 411_600_000, usd: 102_900, source: btcSource, updatedAt: now },
  };
}

test("el bloque en vivo muestra la altura, el hash con sus ceros y lo que minaría un plan", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/network", (route) => route.fulfill({ json: network("mempool") }));
  await page.goto("/");
  const block = page.getByRole("region", { name: "Red Bitcoin en este momento" });
  await expect(block).toContainText("Red Bitcoin en vivo");
  await expect(block).toContainText("Bloque 974.120");
  await expect(block).toContainText(/minado hace 3 min/);
  await expect(block.locator(".block-hash-zeros")).toHaveText("0000000000000000000");
  await expect(block).toContainText("1a6f3c2be7d4598e0c1f2a3b4c5d6e7f8091a2b3c4d5e");
  await expect(block).toContainText("La cordillera de abajo está tejida con este hash");
  await expect(block.getByRole("link", { name: "Ver en mempool.space" })).toHaveAttribute("href", `https://mempool.space/block/${HASH}`);
  await expect(page.getByText(/Desde que abriste esta página, un plan Nonce \(100 TH\/s\) minó/)).toBeVisible();

  // La cordillera se teje con los caracteres del hash, después de sus ceros iniciales.
  const art = page.locator(".landscape .ridges");
  await expect(art).not.toContainText("·");
  const used = new Set((await art.textContent())!.replace(/[\s\u00a0]/g, ""));
  const tail = new Set(HASH.replace(/^0+/, ""));
  expect(used.size).toBeGreaterThan(8);
  for (const ch of used) expect(tail.has(ch)).toBe(true);

  const strip = page.getByRole("region", { name: "La red Bitcoin hoy" });
  await expect(strip).toContainText("1,18 ZH/s");
  await expect(strip).toContainText("+2,75 %");
  await expect(strip).toContainText("en 1.180 bloques");
});

test("el bloque se abre en mempool.space aunque el navegador no abra pestañas nuevas, y el enlace se puede tocar con el dedo", async ({ page }) => {
  await page.route("**/api/network", (route) => route.fulfill({ json: network("mempool") }));
  await page.route("https://mempool.space/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>mempool</title>" }));
  // Como el navegador interno de muchas apps: ignora target="_blank" y window.open no abre nada.
  await page.addInitScript(() => {
    window.open = () => null;
  });
  await page.goto("/");
  const link = page.getByRole("region", { name: "Red Bitcoin en este momento" }).getByRole("link", { name: /mempool\.space/ });
  // 24 px es el mínimo de WCAG 2.2 para un objetivo táctil.
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(24);
  await link.click();
  await expect(page).toHaveURL(`https://mempool.space/block/${HASH}`);
});

test("en un navegador normal el bloque se abre en una pestaña nueva y la portada sigue abierta", async ({ page }) => {
  await page.route("**/api/network", (route) => route.fulfill({ json: network("mempool") }));
  await page.context().route("https://mempool.space/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>mempool</title>" }));
  await page.goto("/");
  const popup = page.waitForEvent("popup");
  await page.getByRole("region", { name: "Red Bitcoin en este momento" }).getByRole("link", { name: /mempool\.space/ }).click();
  expect((await popup).url()).toBe(`https://mempool.space/block/${HASH}`);
  expect(new URL(page.url()).pathname).toBe("/");
});

test("sin conexión con mempool.space se rotulan los valores de referencia y no se inventa un hash", async ({ page }) => {
  await page.route("**/api/network", (route) => route.fulfill({ json: network("referencia") }));
  await page.goto("/");
  const block = page.getByRole("region", { name: "Red Bitcoin en este momento" });
  await expect(block).toContainText("valores de referencia");
  await expect(block).toContainText("altura estimada");
  await expect(block.getByText("El hash del bloque aparece cuando hay conexión con mempool.space.")).toBeVisible();
  await expect(block.getByRole("link", { name: "Ver en mempool.space" })).toHaveCount(0);
  // Sin un hash real, la cordillera se dibuja con puntos: no se inventa un hash.
  await expect(page.locator(".landscape .ridges")).toContainText("·");
  await expect(page.locator(".landscape .ridges")).not.toContainText(/[0-9a-f]/);
});

const COINBASE = /ws-feed\.exchange\.coinbase\.com/;
const tickerMsg = (price: string) => JSON.stringify({ type: "ticker", product_id: "BTC-USD", price, time: new Date().toISOString() });

test("el precio del BTC se mueve en vivo con cada operación de Coinbase, y vuelve al de CoinGecko si se cae", async ({ page }) => {
  await page.route("**/api/network", (route) => route.fulfill({ json: network("mempool") }));
  let feed: WebSocketRoute | undefined;
  let subscribe: unknown;
  await page.routeWebSocket(COINBASE, (ws) => {
    feed = ws;
    ws.onMessage((message) => (subscribe = JSON.parse(String(message))));
  });
  await page.goto("/");
  const strip = page.getByRole("region", { name: "La red Bitcoin hoy" });
  const price = strip.locator(".price-tick");
  // Antes de la primera operación: el precio de /api/network.
  await expect(price).toHaveText("$ 411.600.000");
  await expect.poll(() => subscribe).toEqual({ type: "subscribe", product_ids: ["BTC-USD"], channels: ["ticker"] });

  feed!.send(tickerMsg("103000.50"));
  await expect(price).toHaveText("$ 412.002.000");
  await expect(price).toHaveAttribute("data-dir", "0");
  await expect(strip).toContainText("US$ 103.000,50");
  await expect(strip).toContainText("en vivo");
  // Los planes se estiman con el precio en vivo: 126.000 sats × $ 4.120,02 por cada 1.000 sats.
  const plans = page.getByRole("region", { name: /Elige cuánto hashrate quieres/i });
  const nonce = plans.getByRole("listitem").filter({ has: page.getByRole("heading", { name: /^Plan Nonce$/ }) });
  await expect(nonce).toContainText("$ 519.123");

  feed!.send(tickerMsg("102500"));
  await expect(price).toHaveText("$ 410.000.000");
  await expect(price).toHaveAttribute("data-dir", "-1");

  await feed!.close();
  await expect(price).toHaveText("$ 411.600.000");
  await expect(strip).not.toContainText("en vivo");
});

test("con el precio de referencia no se estima nada en pesos", async ({ page }) => {
  await page.route("**/api/network", (route) => route.fulfill({ json: network("mempool", "referencia") }));
  await page.routeWebSocket(COINBASE, (ws) => void ws.close());
  await page.goto("/");
  const strip = page.getByRole("region", { name: "La red Bitcoin hoy" });
  await expect(strip).toContainText("US$ 102.900, referencia");
  const plans = page.getByRole("region", { name: /Elige cuánto hashrate quieres/i });
  const nonce = plans.getByRole("listitem").filter({ has: page.getByRole("heading", { name: /^Plan Nonce$/ }) });
  await expect(nonce).toContainText("126.000 sats");
  await expect(nonce).not.toContainText("sobre la mensualidad");
});
