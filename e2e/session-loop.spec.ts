import { expect, test, type Page } from "@playwright/test";

const enterWithTestAccount = (page: Page) => page.getByRole("button", { name: /Entrar con la cuenta de pruebas/i }).click();
const notice = (page: Page) => page.getByText(/No pudimos confirmar tu sesión/);

test("si la API no reconoce la sesión que la página sí ve, el panel no se recarga sin fin", async ({ page }) => {
  // Lo que pasaba en Vercel sin una base compartida: las páginas encuentran la sesión y la API la rechaza (401).
  // Las rutas públicas de la API (sin sesión) responden como siempre.
  await page.route("**/api/**", (route) => {
    const { pathname } = new URL(route.request().url());
    if (/^\/api\/(auth|config|health|network|plans|rates|support)(\/|$)/.test(pathname)) return route.continue();
    return route.fulfill({ status: 401, json: { error: "Inicia sesión para continuar" } });
  });
  // Páginas por las que pasa, en orden (cada carga se anuncia dos veces: al llegar y al hidratarse).
  const visited: string[] = [];
  page.on("framenavigated", (frame) => {
    const { pathname } = new URL(frame.url());
    if (frame === page.mainFrame() && visited.at(-1) !== pathname) visited.push(pathname);
  });

  await page.goto("/ingresar");
  await enterWithTestAccount(page);

  // El panel manda a ingresar una vez; ingresar ya no lo devuelve al panel, sino que explica qué pasó.
  await expect(notice(page)).toBeVisible();
  await expect(page).toHaveURL(/\/ingresar\?/);
  await page.waitForTimeout(2_000); // si volviera a rebotar, en este rato regresaría al panel
  expect(visited).toEqual(["/ingresar", "/panel", "/ingresar"]);

  // Cuando la API vuelve a reconocer la sesión, ingresar otra vez lleva al panel y allí se queda.
  await page.unroute("**/api/**");
  await enterWithTestAccount(page);
  await expect(page).toHaveURL(/\/panel$/);
  // El resumen se llena con lo que responde la API (con o sin planes comprados en esta base de pruebas).
  await expect(page.getByRole("heading", { name: /Sats minados por día|Elige tu primer plan/ })).toBeVisible();
});

test("ingresar devuelve al panel con la sesión abierta, salvo si el panel acaba de rechazarla", async ({ page }) => {
  // Sin sesión, el panel manda a ingresar marcando el rechazo, pero no hay nada que explicar: es el ingreso de siempre.
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/ingresar\?/);
  expect(new URL(page.url()).searchParams.get("next")).toBe("/panel");
  expect(new URL(page.url()).searchParams.get("sesion")).toBe("cerrada");
  await expect(page.getByRole("button", { name: /Entrar con la cuenta de pruebas/i })).toBeVisible();
  await expect(notice(page)).toHaveCount(0);

  await enterWithTestAccount(page);
  await expect(page).toHaveURL(/\/panel$/);

  // Con la sesión abierta, ingresar lleva directo al destino…
  await page.goto("/ingresar?next=%2Fpanel%2Fbilletera");
  await expect(page).toHaveURL(/\/panel\/billetera$/);

  // …pero si el destino acaba de rechazarla, devolverlo allí sería un bucle: se queda y lo explica.
  await page.goto("/ingresar?next=%2Fpanel%2Fbilletera&sesion=cerrada");
  await expect(notice(page)).toBeVisible();
  await expect(page).toHaveURL(/\/ingresar\?/);
});
