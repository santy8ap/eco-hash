import { expect, test } from "@playwright/test";

const HASH = "00000000000000000001a6f3c2be7d4598e0c1f2a3b4c5d6e7f8091a2b3c4d5e";

function network(source: "mempool" | "referencia") {
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
    btc: { cop: 412_350_000, usd: 102_900, source: "coingecko", updatedAt: now },
  };
}

test("el bloque en vivo muestra la altura, el hash con sus ceros y lo que minaría un plan", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/network", (route) => route.fulfill({ json: network("mempool") }));
  await page.goto("/");
  const block = page.getByRole("region", { name: "Red Bitcoin en este momento" });
  await expect(block).toContainText("Red Bitcoin en vivo");
  await expect(block).toContainText("974.120");
  await expect(block).toContainText(/hace 3 min/);
  await expect(block.locator(".block-hash-zeros")).toHaveText("0000000000000000000");
  await expect(block).toContainText("1a6f3c2be7d4598e0c1f2a3b4c5d6e7f8091a2b3c4d5e");
  await expect(block.getByRole("link", { name: "Ver en mempool.space" })).toHaveAttribute("href", `https://mempool.space/block/${HASH}`);
  await expect(block).toContainText("1.180 bloques");
  await expect(block).toContainText(/Un plan Nonce \(100 TH\/s\) minó desde que abriste esta página/);

  const strip = page.getByRole("region", { name: "La red Bitcoin hoy" });
  await expect(strip).toContainText("1,2 ZH/s");
  await expect(strip).toContainText("+2,75 %");
});

test("sin conexión con mempool.space se rotulan los valores de referencia y no se inventa un hash", async ({ page }) => {
  await page.route("**/api/network", (route) => route.fulfill({ json: network("referencia") }));
  await page.goto("/");
  const block = page.getByRole("region", { name: "Red Bitcoin en este momento" });
  await expect(block).toContainText("valores de referencia");
  await expect(block).toContainText("altura estimada");
  await expect(block.getByText("El hash del bloque aparece cuando hay conexión con mempool.space.")).toBeVisible();
  await expect(block.getByRole("link", { name: "Ver en mempool.space" })).toHaveCount(0);
});
