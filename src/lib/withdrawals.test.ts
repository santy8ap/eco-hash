import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DAY_MS, bogotaMs } from "@/lib/time";
import { createUser } from "../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "ech-retiros-")), "test.db")}`;
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");

let portfolio: typeof import("@/lib/portfolio");
let withdrawals: typeof import("@/lib/withdrawals");
let pay: typeof import("@/lib/payments/test-payment");
let admin: typeof import("@/lib/admin/service");
const actor = { id: "admin-test", name: "Admin de prueba" };
const ADDR = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
const OTHER_ADDR = "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0";
const TXID = "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16";

/** El reloj de las pruebas: el plan se paga un 10 de noviembre a las 12:30 p. m. */
const T0 = bogotaMs(2026, 11, 10, 12, 30);

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  // El precio del BTC que usan los retiros para su equivalente en pesos: fijo, sin salir a internet.
  vi.stubGlobal("fetch", async () => Response.json({ bitcoin: { cop: 400_000_000, usd: 100_000 } }));
  portfolio = await import("@/lib/portfolio");
  withdrawals = await import("@/lib/withdrawals");
  pay = await import("@/lib/payments/test-payment");
  admin = await import("@/lib/admin/service");
  for (const id of ["c1", "c2", "c3", "c4", "c5", "doble", "justo"]) await createUser(id);
  await createUser("sin-datos", { profile: false });
  // Génesis: 1.000 TH/s × 42 sats = 42.000 sats al día.
  for (const id of ["c1", "c2", "c3", "c4", "doble", "justo"]) await pay.payWithTestPayment({ userId: id, planId: "h1000" });
}, 120_000);

afterEach(() => {
  vi.stubEnv("DEMO_MODE", "");
});
afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("minería y saldo de un plan", () => {
  it("recién pagado: el plan está activo, guarda su hashprice y todavía no ha minado", async () => {
    const p = await portfolio.getPortfolio("c1");
    expect(p.subscriptions).toHaveLength(1);
    expect(p.subscriptions[0]).toMatchObject({ planName: "Génesis", state: "activa", paidMonths: 1, months: 3, monthlyCop: 2_300_000, hashrateTh: 1000, priceCopPerThMonth: 2300 });
    expect(p.subscriptions[0].periods[0].satsPerThDay).toBe(42);
    expect(p.subscriptions[0].paidUntil).toBe(T0 + 30 * DAY_MS);
    expect(p).toMatchObject({ minedSats: 0, balanceSats: 0, activeTh: 1000, dailySats: 42_000 });
    expect(p.transactions[0]).toMatchObject({ kind: "plan_mes", status: "confirmada", method: "demo", amountCop: 2_300_000, hashrateTh: 1000, periodIndex: 1 });
  });

  it("diez días después: 420.000 sats minados, día y noche, con su costo proporcional", async () => {
    vi.setSystemTime(T0 + 10 * DAY_MS);
    const p = await portfolio.getPortfolio("c1");
    expect(p.minedSats).toBeCloseTo(420_000, 6);
    expect(p.costCop).toBeCloseTo(2_300_000 / 3, 4);
    // A las 12:30 va el 52 % del día: 12,5 de 24 horas.
    expect(p.todaySats).toBeCloseTo(21_875, 6);
    expect(p.balanceSats).toBe(420_000);
  });

  it("al terminar el mes sin pagar el siguiente, la minería se pausa y el saldo deja de crecer", async () => {
    vi.setSystemTime(T0 + 33 * DAY_MS);
    const p = await portfolio.getPortfolio("c1");
    expect(p.subscriptions[0]).toMatchObject({ state: "en_pausa", graceEndsAt: T0 + 45 * DAY_MS });
    expect(p.minedSats).toBeCloseTo(1_260_000, 6);
    expect(p.activeTh).toBe(0);
    vi.setSystemTime(T0 + 10 * DAY_MS);
  });
});

describe("retiros en BTC", () => {
  it("a una dirección Bitcoin: queda en revisión, aparta los sats y guarda su equivalente en pesos", async () => {
    const w = await withdrawals.createBtcWithdrawal({ userId: "c1", amountSats: 300_000.9, address: ` ${ADDR.toUpperCase()} ` });
    expect(w).toMatchObject({ kind: "retiro", status: "por_aprobar", amountSats: 300_000, amountCop: 1_200_000, asset: "BTC", assetAmount: 0.003, network: "Bitcoin", walletAddress: ADDR });
    expect(await portfolio.getPortfolio("c1")).toMatchObject({ reservedSats: 300_000, balanceSats: 120_000 });
  });

  it("no deja retirar más que el saldo, ni menos que el mínimo", async () => {
    await expect(withdrawals.createBtcWithdrawal({ userId: "c1", amountSats: 120_001, address: ADDR })).rejects.toThrow(/saldo suficiente/);
    await expect(withdrawals.createBtcWithdrawal({ userId: "c1", amountSats: 49_999, address: ADDR })).rejects.toMatchObject({ status: 400, extra: { fields: { amountSats: expect.stringMatching(/mínimo/) } } });
  });

  it("valida la dirección e indica el campo; testnet solo en modo de pruebas", async () => {
    await expect(withdrawals.createBtcWithdrawal({ userId: "c1", amountSats: 60_000, address: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5" })).rejects.toMatchObject({ status: 400, extra: { fields: { address: expect.stringMatching(/no es válida/) } } });
    await expect(withdrawals.createBtcWithdrawal({ userId: "c1", amountSats: 60_000, address: "0x52908400098527886E0F7030069857D2E4169EE7" })).rejects.toMatchObject({ status: 400 });
    vi.stubEnv("DEMO_MODE", "false");
    await expect(withdrawals.createBtcWithdrawal({ userId: "c1", amountSats: 60_000, address: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx" })).rejects.toThrow(/red de pruebas/);
  });

  it("dos retiros simultáneos no pueden gastar los mismos sats", async () => {
    // c2 tiene 420.000 sats: dos retiros de 300.000 a la vez, solo uno puede pasar.
    // (A direcciones distintas: la misma solicitud repetida es un doble clic, que se prueba aparte.)
    const results = await Promise.allSettled([
      withdrawals.createBtcWithdrawal({ userId: "c2", amountSats: 300_000, address: ADDR }),
      withdrawals.createBtcWithdrawal({ userId: "c2", amountSats: 300_000, address: OTHER_ADDR }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await portfolio.getPortfolio("c2")).balanceSats).toBe(120_000);
  });

  it("un doble clic no crea dos retiros: la misma solicitud repetida devuelve la que ya está en revisión", async () => {
    const start = Date.now();
    const before = (await portfolio.getPortfolio("doble")).balanceSats;
    const [a, b] = await Promise.all([
      withdrawals.createBtcWithdrawal({ userId: "doble", amountSats: 100_000, address: ADDR }),
      withdrawals.createBtcWithdrawal({ userId: "doble", amountSats: 100_000, address: ADDR }),
    ]);
    const again = await withdrawals.createBtcWithdrawal({ userId: "doble", amountSats: 100_000, address: ADDR });
    expect(new Set([a.id, b.id, again.id]).size).toBe(1);
    expect((await portfolio.getPortfolio("doble")).balanceSats).toBe(before - 100_000);
    // Otro monto u otra dirección es otro retiro.
    const other = await withdrawals.createBtcWithdrawal({ userId: "doble", amountSats: 120_000, address: ADDR });
    expect(other.id).not.toBe(a.id);
    // Pasados dos minutos, repetirlo ya es una solicitud nueva.
    vi.setSystemTime(start + 2 * 60_000 + 1);
    const later = await withdrawals.createBtcWithdrawal({ userId: "doble", amountSats: 100_000, address: ADDR });
    expect(later.id).not.toBe(a.id);
    expect((await portfolio.getPortfolio("doble")).reservedSats).toBe(320_000);
    vi.setSystemTime(start);
  });

  it("si el saldo alcanza para un solo retiro, el doble clic no muestra «sin saldo»: devuelve el que se creó", async () => {
    const { balanceSats } = await portfolio.getPortfolio("justo");
    const first = await withdrawals.createBtcWithdrawal({ userId: "justo", amountSats: balanceSats, address: ADDR });
    const second = await withdrawals.createBtcWithdrawal({ userId: "justo", amountSats: balanceSats, address: ADDR });
    expect(second.id).toBe(first.id);
  });

  it("el retiro de otro cliente no se puede consultar", async () => {
    const w = await withdrawals.createBtcWithdrawal({ userId: "c3", amountSats: 60_000, address: ADDR });
    await expect(withdrawals.getWithdrawal("c4", w.id)).rejects.toMatchObject({ status: 404 });
  });

  it("sin los datos personales no se puede retirar", async () => {
    await expect(withdrawals.createBtcWithdrawal({ userId: "sin-datos", amountSats: 60_000, address: ADDR })).rejects.toMatchObject({ status: 412 });
  });

  it("al enviarlo pasa a retirado con su txid; al rechazarlo, los sats vuelven", async () => {
    const a = await withdrawals.createBtcWithdrawal({ userId: "c4", amountSats: 200_000, address: ADDR });
    const b = await withdrawals.createBtcWithdrawal({ userId: "c4", amountSats: 100_000, address: ADDR });
    await admin.decideWithdrawal(actor, a.id, "aprobar", "", TXID.toUpperCase());
    await admin.decideWithdrawal(actor, b.id, "rechazar", "La dirección no coincide con la que confirmó el titular");
    const p = await portfolio.getPortfolio("c4");
    expect(p).toMatchObject({ withdrawnSats: 200_000, reservedSats: 0, balanceSats: 220_000 });
    expect(p.transactions.find((t) => t.id === a.id)).toMatchObject({ status: "confirmada", txHash: TXID });
    expect(p.transactions.find((t) => t.id === b.id)).toMatchObject({ status: "rechazada", note: expect.stringMatching(/no coincide/) });
  });

  it("aprobar exige un txid de 64 caracteres; en modo de pruebas, vacío genera uno simulado", async () => {
    const w = await withdrawals.createBtcWithdrawal({ userId: "c4", amountSats: 50_000, address: ADDR });
    await expect(admin.decideWithdrawal(actor, w.id, "aprobar", "", "COMPROBANTE-123")).rejects.toThrow(/64 caracteres/);
    vi.stubEnv("DEMO_MODE", "false");
    await expect(admin.decideWithdrawal(actor, w.id, "aprobar")).rejects.toThrow(/txid/i);
    vi.stubEnv("DEMO_MODE", "");
    const ok = await admin.decideWithdrawal(actor, w.id, "aprobar");
    expect(ok).toMatchObject({ status: "confirmada", txHash: expect.stringMatching(/^[0-9a-f]{64}$/) });
  });

  it("el admin ve la dirección completa, los sats y los datos del titular", async () => {
    const list = await admin.listWithdrawals();
    const row = list.find((w) => w.userId === "c1");
    expect(row).toMatchObject({ walletAddress: ADDR, amountSats: 300_000, companyName: "Empresa c1", customerId: "900123456-8" });
  });

  it("la exportación para la contabilidad trae la dirección, los sats, el BTC y el txid, sin el del rechazado", async () => {
    const { withdrawalsCsv } = await import("@/lib/admin/withdrawals-export");
    const { csvLine } = await import("@/lib/csv");
    const csv = withdrawalsCsv(await admin.listWithdrawals({ limit: 10_000 }));
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n").filter(Boolean);
    expect(lines[0]).toBe(csvLine(["Solicitado (Colombia)", "Enviado o rechazado (Colombia)", "Retiro", "Cliente", "Titular", "NIT o documento", "Correo", "Dirección Bitcoin", "Estado", "Sats", "BTC", "Equivalente COP al pedirlo", "Txid", "Nota"]).trimEnd());
    const paid = lines.find((l) => l.includes(TXID))!;
    expect(paid).toContain(`"Empresa c4";"Laura Gómez";"900123456-8";"c4@empresa.co";"${ADDR}"`);
    expect(paid).toContain('"200000";"0.00200000";"800000"');
    const rejected = lines.find((l) => l.includes("no coincide"))!;
    expect(rejected).toContain('"100000";"0.00100000";"400000";""');
    // Todos los retiros de la base, no solo los 200 de la pantalla.
    expect(lines.length - 1).toBe((await admin.listWithdrawals({ limit: 10_000 })).length);
  });
});

describe("pago de prueba", () => {
  it("solo existe en modo de pruebas", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    await expect(pay.payWithTestPayment({ userId: "c5", planId: "h100" })).rejects.toMatchObject({ status: 403 });
  });

  it("exige los datos personales", async () => {
    await expect(pay.payWithTestPayment({ userId: "sin-datos", planId: "h100" })).rejects.toMatchObject({ status: 412 });
  });

  it("rechaza un plan que no existe", async () => {
    await expect(pay.payWithTestPayment({ userId: "c5", planId: "p180" })).rejects.toThrow(/planes disponibles/);
  });
});
