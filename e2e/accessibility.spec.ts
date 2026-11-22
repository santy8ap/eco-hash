import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/** axe-core, el motor de auditoría de accesibilidad, inyectado en la página. */
const AXE = path.join(process.cwd(), "node_modules/axe-core/axe.min.js");

/** Problemas graves o críticos de accesibilidad en lo que se ve ahora (contraste, nombres, anidamientos inválidos…). */
async function seriousViolations(page: Page) {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    type AxeResult = { violations: { id: string; impact: string | null; nodes: { target: string[] }[] }[] };
    const axe = (window as unknown as { axe: { run: (context: Document) => Promise<AxeResult> } }).axe;
    const { violations } = await axe.run(document);
    return violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  });
}

const network = () => {
  const now = Date.now();
  return {
    network: {
      height: 976_812,
      lastBlockAt: now - 120_000,
      lastBlockHash: "00000000000000000001bc5f7cd24c37fda0f0a43fcb95a35c1971deb0fd481e",
      hashrateEh: 1045.8,
      difficulty: 1.348e14,
      adjustment: { progressPct: 52, remainingBlocks: 950, changePct: 8.5, etaMs: now + 6 * 86_400_000 },
      networkHashpriceSats: 43.4,
      source: "mempool",
      updatedAt: now,
    },
    // Con este precio el plan pequeño da pérdida (texto coral) y los grandes, ganancia (texto verde).
    btc: { cop: 201_000_000, usd: 58_600, source: "coingecko", updatedAt: now },
  };
};

async function setUp(page: Page, theme: "dark" | "light") {
  await page.addInitScript((mode) => localStorage.setItem("ech:theme", mode), theme);
  await page.route("**/api/network", (route) => route.fulfill({ json: network() }));
  await page.routeWebSocket(/ws-feed\.exchange\.coinbase\.com/, () => {});
}

for (const theme of ["dark", "light"] as const) {
  test(`la portada no tiene problemas graves de accesibilidad (tema ${theme === "dark" ? "oscuro" : "claro"})`, async ({ page }) => {
    await setUp(page, theme);
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Red Bitcoin en este momento" })).toContainText("Red Bitcoin en vivo");
    await expect(page.getByText("sobre la mensualidad").first()).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
}

test("el panel, la billetera y el admin no tienen problemas graves de accesibilidad (tema claro)", async ({ page }) => {
  await setUp(page, "light");
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Entrar con la cuenta de pruebas/i }).click();
  await expect(page).toHaveURL(/\/panel$/);

  // Un mes de prueba para que el panel tenga su gráfica, sus planes y sus movimientos.
  await page.goto("/comprar?plan=h100");
  const name = page.getByLabel("Nombre completo", { exact: true });
  const saved = page.getByRole("button", { name: "Continuar al resumen", exact: true });
  await expect(page.getByRole("heading", { name: /Así es tu plan/i }).or(saved).or(name)).toBeVisible();
  if (await name.isVisible()) {
    await name.fill("Mariana Gómez de Prueba");
    await page.getByLabel("Número de documento", { exact: true }).fill("1036123456");
    await page.getByLabel("Celular", { exact: true }).fill("3001234567");
    await page.getByLabel("Ciudad de residencia", { exact: true }).fill("Medellín");
    await page.getByRole("checkbox", { name: /Acepto los/i }).press("Space");
    await page.getByRole("button", { name: /Guardar y continuar al resumen/i }).click();
  } else if (await saved.isVisible()) {
    await saved.click();
  }
  await page.getByRole("button", { name: /Elegir medio de pago/i }).click();
  await page.getByRole("button", { name: /Confirmar pago de prueba/i }).click();
  await expect(page.getByRole("heading", { name: "Pago confirmado" })).toBeVisible();

  await page.goto("/panel");
  await expect(page.getByRole("heading", { name: "Sats minados por día" })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  await page.goto("/panel/billetera");
  await page.getByRole("button", { name: "Retirar a mi billetera" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  for (const url of ["/admin", "/admin/clientes", "/admin/pagos", "/admin/configuracion"]) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    expect(await seriousViolations(page), url).toEqual([]);
  }
});
