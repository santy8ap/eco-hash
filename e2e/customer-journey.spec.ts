import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";

test("la ayuda y las rutas privadas responden correctamente", async ({ page, request }) => {
  await page.goto("/ayuda");
  await expect(page.getByRole("heading", { name: /¿En qué te ayudamos\?/i })).toBeVisible();
  for (const url of ["/api/transactions", "/api/transactions/export", "/api/receipts/ECH-12345678", "/api/portfolio"]) {
    expect((await request.get(url)).status()).toBe(401);
  }
  expect((await request.get("/api/cron/payments")).status()).toBe(401);
  // Los datos de la red son públicos, con valores reales o de referencia rotulados.
  const network = await (await request.get("/api/network")).json();
  expect(["mempool", "referencia"]).toContain(network.network.source);
  expect(network.network.height).toBeGreaterThan(900_000);
  expect(network.btc.cop).toBeGreaterThan(0);
});

test("la portada lleva a los planes con su mensualidad, sus sats y el enlace de compra", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  const nav = header.getByRole("navigation", { name: "Secciones" });
  // En celular la navegación por secciones no se muestra: se baja con el botón del inicio.
  if (await nav.isVisible()) await nav.getByRole("link", { name: "Planes", exact: true }).click();
  else await page.getByRole("link", { name: "Ver los planes" }).click();
  await expect(page).toHaveURL(/\/#planes$/);

  const plans = page.getByRole("region", { name: /Elige cuánto hashrate quieres/i });
  const nonce = plans.getByRole("listitem").filter({ has: page.getByRole("heading", { name: /^Plan Nonce$/ }) });
  await expect(nonce).toContainText("100 TH/s");
  await expect(nonce).toContainText("460.000");
  await expect(nonce).toContainText("126.000 sats");
  await expect(nonce.getByRole("link", { name: "Elegir Nonce" })).toHaveAttribute("href", "/comprar?plan=h100");
  await expect(plans.getByRole("listitem")).toHaveCount(4);
  await expect(plans.getByText(/Son estimaciones/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test("un plan sin capacidad libre no se puede elegir", async ({ page }) => {
  await page.route("**/api/plans", async (route) => {
    const response = await route.fetch();
    const catalog = await response.json();
    for (const plan of catalog.plans) plan.available = plan.id !== "h1000";
    await route.fulfill({ response, json: catalog });
  });
  await page.goto("/#planes");
  const plans = page.getByRole("region", { name: /Elige cuánto hashrate quieres/i });
  await expect(plans.getByRole("link", { name: "Elegir Génesis" })).toHaveCount(0);
  await expect(plans.getByText("Sin capacidad")).toBeVisible();
  await expect(plans.getByRole("link", { name: "Elegir Cadena" })).toHaveAttribute("href", "/comprar?plan=h500");
});

test("el resultado muestra el comprobante solo cuando se confirma el pago", async ({ page }) => {
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Entrar con la cuenta de pruebas/i }).click();
  await expect(page).toHaveURL(/\/panel$/);

  const ref = "ECH-12345678";
  let confirmed = false;
  await page.route("**/api/payments/mercadopago/sync", (route) =>
    route.fulfill({
      json: {
        order: {
          id: ref,
          amountCop: 460_000,
          hashrateTh: 100,
          periodIndex: 2,
          method: "mercadopago",
          network: "Mercado Pago (pruebas)",
          status: confirmed ? "confirmada" : "pendiente",
        },
        outcome: confirmed ? "aprobada" : "sin_pago",
      },
    }),
  );

  await page.goto(`/pagos/resultado?ref=${ref}`);
  await expect(page.getByRole("heading", { name: "Pago aún sin confirmar" })).toBeVisible();
  const receipt = page.getByRole("button", { name: "Comprobante PDF" });
  await expect(receipt).toHaveCount(0);

  confirmed = true;
  await page.getByRole("button", { name: "Volver a consultar" }).click();
  await expect(page.getByRole("heading", { name: "Pago confirmado" })).toBeVisible();
  await expect(page.getByText(/Si pagaste por adelantado, el mes nuevo empieza al terminar el anterior/)).toBeVisible();
  await expect(page.getByText(/Operación de prueba/)).toBeVisible();
  await expect(receipt).toBeVisible();
});

test("plan → ingreso → datos personales → resumen → pago de prueba → panel minando → PDF e historial", async ({ page }) => {
  const config = await (await page.request.get("/api/config")).json();
  expect(config.demoMode).toBe(true);
  expect(config.mercadopago.enabled).toBe(false);
  expect(config.crypto.enabled).toBe(false);
  const db = createClient({ url: process.env.E2E_DATABASE_URL! });
  try {
    // Solo el perfil ficticio de esta base temporal: cada viewport recorre el formulario completo.
    await db.execute("DELETE FROM company_profile WHERE user_id IN (SELECT id FROM user WHERE email = 'pruebas@eco-hash.local')");
  } finally {
    db.close();
  }
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#planes");
  await page.locator('a[href="/comprar?plan=h100"]:visible').click();
  await expect(page).toHaveURL(/\/ingresar\?next=%2Fcomprar%3Fplan%3Dh100$/);
  await expect(page.getByText(/Elegiste el plan Nonce/)).toBeVisible();
  await page.getByRole("button", { name: /Entrar con la cuenta de pruebas/i }).click();
  await expect(page).toHaveURL(/\/comprar\?plan=h100$/);
  await expect(page.getByRole("heading", { name: /Tus datos, tu minería/i })).toBeVisible();
  await expect(page.getByLabel(/Razón social|NIT/i)).toHaveCount(0);
  await page.getByLabel("Nombre completo", { exact: true }).fill("Mariana Gómez de Prueba");
  await page.getByLabel("Número de documento", { exact: true }).fill("1036123456");
  await page.getByLabel("Celular", { exact: true }).fill("3001234567");
  await page.getByLabel("Ciudad de residencia", { exact: true }).fill("Medellín");
  await page.getByRole("checkbox", { name: /Acepto los/i }).press("Space");
  await page.getByRole("button", { name: /Guardar y continuar al resumen/i }).click();
  await expect(page.getByRole("heading", { name: /Así es tu plan/i })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Resumen del plan" })).toContainText("460.000");
  const breakdown = page.getByRole("region", { name: "Mensualidad y minería estimada" });
  await expect(breakdown).toContainText("126.000 sats");
  await expect(breakdown).toContainText("100 TH/s × 42 sats/TH/día × 30 días");

  const configUrl = "**/api/config";
  await page.route(configUrl, (route) => route.fulfill({ status: 503, json: { error: "Configuración no disponible." } }));
  await page.getByRole("button", { name: /Elegir medio de pago/i }).click();
  await expect(page.getByText("No pudimos cargar los medios de pago.")).toBeVisible();
  await page.unroute(configUrl);
  await page.getByRole("button", { name: "Volver a cargar" }).click();
  const paidResponse = page.waitForResponse((response) => response.url().endsWith("/api/payments/test") && response.request().method() === "POST");
  await page.getByRole("button", { name: /Confirmar pago de prueba/i }).click();
  const response = await paidResponse;
  expect(response.ok()).toBe(true);
  const { order } = await response.json();
  await expect(page.getByRole("heading", { name: "Pago confirmado" })).toBeVisible();
  await expect(page.getByText(/Registramos el pago del mes 1 de tu plan\. Tus 100 TH\/s minan durante 30 días\./)).toBeVisible();
  await expect(page.getByText(/Operación de prueba/)).toBeVisible();
  await expect(page.getByText(order.id, { exact: true })).toBeVisible();
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /Comprobante PDF/i }).click();
  const pdf = await pdfDownload;
  expect((await readFile((await pdf.path())!)).subarray(0, 5).toString()).toBe("%PDF-");

  // El panel muestra el plan minando y el contador de sats.
  await page.goto("/panel");
  await expect(page.getByRole("region", { name: "Minado en total" })).toContainText(/Minando con [\d.]+ TH\/s/);
  await expect(page.getByRole("heading", { name: "Sats minados por día" })).toBeVisible();
  await page.getByRole("button", { name: "Ver como tabla" }).click();
  await expect(page.getByRole("table").getByText("Hoy (en curso)")).toBeVisible();

  await page.goto("/panel/billetera");
  const history = page.getByRole("region", { name: "Historial completo de movimientos" });
  await expect(history.getByText(order.id, { exact: false })).toBeVisible();
  const csvDownload = page.waitForEvent("download");
  await history.getByRole("link", { name: /Exportar CSV/i }).click();
  const csv = await csvDownload;
  expect(await readFile((await csv.path())!, "utf8")).toContain(order.id);

  // Retirar: la dirección se valida antes de enviar y el saldo recién minado no alcanza el mínimo.
  await page.getByRole("button", { name: "Retirar a mi billetera" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Dirección Bitcoin de destino").fill("0x52908400098527886E0F7030069857D2E4169EE7");
  await dialog.getByRole("button", { name: "Solicitar retiro" }).click();
  await expect(dialog.getByText(/El retiro mínimo es de 50\.000 sats/)).toBeVisible();
  await expect(dialog.getByText(/Ethereum o BNB Chain/)).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/panel/avisos");
  await expect(page.getByText("Pago del plan confirmado", { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
