import { expect, test } from "@playwright/test";

test("el tema oscuro y el claro se aplican y la preferencia se conserva", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  const root = page.locator("html");
  const toggle = page.getByRole("button", { name: /^Tema / });
  const themeColor = page.locator('meta[name="theme-color"]');
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(root).toHaveCSS("background-color", "rgb(13, 19, 17)");
  await expect(toggle).toHaveAccessibleName(/Tema oscuro\. Cambiar a claro/);

  await toggle.click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(root).toHaveCSS("background-color", "rgb(242, 244, 240)");
  await expect(root).toHaveCSS("color-scheme", "light");
  await expect(themeColor).toHaveAttribute("content", "#f2f4f0");

  // Se conserva al recargar y al cambiar de página.
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.getByRole("banner").getByRole("link", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(root).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: /Entrar con la cuenta de pruebas/i }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: /^Tema claro/ }).first().click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(root).toHaveCSS("background-color", "rgb(13, 19, 17)");
  await expect(themeColor).toHaveAttribute("content", "#0d1311");
  expect(errors).toEqual([]);
});

test("la portada respeta la preferencia de movimiento reducido", async ({ page }) => {
  // Duración (en segundos) del latido del LED «en línea»: con movimiento reducido queda en casi cero.
  const pulse = () =>
    page.locator(".live-dot").first().evaluate((el) => parseFloat(getComputedStyle(el, "::after").animationDuration));
  // El río de ceros de la cordillera corre despacio; con movimiento reducido se queda quieto.
  const river = () => page.locator(".river-flow").first().evaluate((el) => parseFloat(getComputedStyle(el).animationDuration));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect.poll(pulse).toBeGreaterThan(1);
  await expect.poll(river).toBeGreaterThan(60);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(pulse).toBeLessThan(0.001);
  await expect.poll(river).toBeLessThan(0.001);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver los planes" })).toBeVisible();
});

test("con el tema claro guardado, el panel y el admin cargan sin errores de hidratación y con el ícono correcto", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("ech:theme", "light"));
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Entrar con la cuenta de pruebas/i }).click();
  await expect(page).toHaveURL(/\/panel$/);
  // Cargas completas: el HTML del servidor (tema por defecto) tiene que hidratar con el tema guardado.
  for (const url of ["/panel", "/panel/perfil", "/admin"]) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const toggle = page.getByRole("button", { name: /^Tema / }).first();
    await expect(toggle).toHaveAccessibleName("Tema claro. Cambiar a oscuro");
  }
  expect(errors).toEqual([]);
});
