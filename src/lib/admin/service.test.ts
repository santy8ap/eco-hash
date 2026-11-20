import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DAY_MS, bogotaMs } from "@/lib/time";
import { createUser } from "../../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "ech-admin-")), "test.db")}`;
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");

let admin: typeof import("@/lib/admin/service");
let plans: typeof import("@/lib/plans/service");
let portfolio: typeof import("@/lib/portfolio");
let settings: typeof import("@/lib/settings");
let pay: typeof import("@/lib/payments/test-payment");
const actor = { id: "admin-test", name: "Admin de prueba" };
const T0 = bogotaMs(2026, 11, 10, 12, 30);

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  admin = await import("@/lib/admin/service");
  plans = await import("@/lib/plans/service");
  portfolio = await import("@/lib/portfolio");
  settings = await import("@/lib/settings");
  pay = await import("@/lib/payments/test-payment");
  await createUser("a1", { name: "Textiles del Valle S.A.S." });
  await createUser("a2", { name: "Frigoríficos Andinos S.A." });
  await createUser("a3", { name: "Plásticos Unidos Ltda." });
  await createUser("nuevo", { profile: false, name: "Sin Empresa" });
}, 120_000);

afterAll(() => {
  vi.useRealTimers();
});

describe("pago manual (transferencia bancaria)", () => {
  it("exige la referencia del comprobante", async () => {
    await expect(admin.registerManualPayment(actor, { userId: "a1", planId: "h250", reference: " " })).rejects.toThrow(/referencia/i);
  });

  it("activa el mes, queda como pago real y deja constancia en la bitácora", async () => {
    const tx = await admin.registerManualPayment(actor, { userId: "a1", planId: "h250", reference: "TRANSF-0001" });
    expect(tx).toMatchObject({ kind: "plan_mes", status: "confirmada", method: "manual", amountCop: 1_112_500, hashrateTh: 250, periodIndex: 1 });
    const [sub] = await plans.listSubscriptions("a1");
    expect(sub).toMatchObject({ planId: "h250", hashrateTh: 250, priceCopPerThMonth: 4450 });
    expect(sub.periods[0]).toMatchObject({ hashrateTh: 250, satsPerThDay: 42, amountCop: 1_112_500 });
    const [entry] = await admin.listAudit(1);
    expect(entry).toMatchObject({ action: "pago_manual", targetUserId: "a1" });
    expect(entry.summary).toMatch(/Textiles del Valle.*Bloque, mes 1 de 3.*TRANSF-0001/);
  });

  it("una referencia no se puede registrar dos veces", async () => {
    await expect(admin.registerManualPayment(actor, { userId: "a2", planId: "h100", reference: "TRANSF-0001" })).rejects.toMatchObject({ status: 409 });
    expect(await plans.listSubscriptions("a2")).toHaveLength(0);
  });

  it("el mes siguiente se registra sobre el plan del cliente", async () => {
    const [sub] = await plans.listSubscriptions("a1");
    const tx = await admin.registerManualPayment(actor, { userId: "a1", subscriptionId: sub.id, reference: "TRANSF-0002" });
    expect(tx).toMatchObject({ periodIndex: 2, subscriptionId: sub.id });
  });

  it("no se registra para un cliente que no ha completado sus datos personales", async () => {
    await expect(admin.registerManualPayment(actor, { userId: "nuevo", planId: "h100", reference: "TRANSF-0003" })).rejects.toMatchObject({ status: 412 });
  });
});

describe("cerrar un plan", () => {
  it("deja de minar en ese instante, libera su capacidad y no admite más pagos", async () => {
    await pay.payWithTestPayment({ userId: "a2", planId: "h1000" });
    const [sub] = await plans.listSubscriptions("a2");
    const before = await plans.contractedTh();
    vi.setSystemTime(T0 + 5 * DAY_MS);
    await expect(admin.closeSubscription(actor, sub.id, "")).rejects.toThrow(/motivo/);
    await admin.closeSubscription(actor, sub.id, "El pago fue devuelto por el banco");
    expect(await plans.contractedTh()).toBe(before - 1000);

    vi.setSystemTime(T0 + 20 * DAY_MS);
    const p = await portfolio.getPortfolio("a2");
    expect(p.subscriptions[0].state).toBe("cancelada");
    // Minó 5 días (210.000 sats) y ahí se detuvo.
    expect(p.minedSats).toBeCloseTo(210_000, 4);
    expect(p.activeTh).toBe(0);
    await expect(pay.payWithTestPayment({ userId: "a2", subscriptionId: sub.id })).rejects.toMatchObject({ status: 409 });
    await expect(admin.closeSubscription(actor, sub.id, "otra vez")).rejects.toMatchObject({ status: 409 });
    vi.setSystemTime(T0);
  });

});

describe("clientes y resumen", () => {
  it("lista los clientes con sus planes, sus sats y su saldo", async () => {
    // Seis días después del primer pago (el plan de a2 se cerró al quinto día).
    vi.setSystemTime(T0 + 6 * DAY_MS);
    const clients = await admin.listClients();
    const a1 = clients.find((c) => c.id === "a1")!;
    expect(a1.profile).toMatchObject({ companyName: "Textiles del Valle S.A.S.", nit: "900123456-8", termsCurrent: true });
    expect(a1.plans).toHaveLength(1);
    expect(a1.plans[0]).toMatchObject({ planName: "Bloque", state: "activa", paidMonths: 2 });
    expect(a1.minedSats).toBe(63_000);
    expect(a1.activeTh).toBe(250);
    expect(a1.balanceSats).toBe(63_000);
    expect(clients.find((c) => c.id === "nuevo")).toMatchObject({ profile: null, plans: [], balanceSats: 0 });
    // Primero quienes tienen planes.
    expect(clients[0].plans.length).toBeGreaterThan(0);
  });

  it("busca por razón social, NIT o correo", async () => {
    expect((await admin.listClients({ query: "frigor" })).map((c) => c.id)).toEqual(["a2"]);
    expect((await admin.listClients({ query: "a3@empresa" })).map((c) => c.id)).toEqual(["a3"]);
    expect(await admin.listClients({ query: "no-existe-xyz" })).toEqual([]);
  });

  it("el resumen muestra la capacidad, lo cobrado y los sats que se les deben a los clientes", async () => {
    const o = await admin.adminOverview();
    expect(o).toMatchObject({ capacityTh: 30_000, contractedTh: 250, availableTh: 29_750, activeTh: 250, dailySats: 10_500, activePlans: 1, clients: 1, pendingWithdrawals: 0 });
    // Dos meses del Bloque (transferencias registradas) y uno del Génesis (pago de prueba).
    expect(o.collectedCop).toBe(1_112_500 * 2 + 4_200_000);
    // Con dinero real, lo cobrado no cuenta los pagos de prueba.
    vi.stubEnv("DEMO_MODE", "false");
    expect((await admin.adminOverview()).collectedCop).toBe(1_112_500 * 2);
    vi.stubEnv("DEMO_MODE", "");
    // a1: 6 días × 10.500 sats; a2: 5 días × 42.000 sats antes del cierre.
    expect(o.owedSats).toBe(63_000 + 210_000);
    expect(o.minedSats).toBe(273_000);
    vi.setSystemTime(T0);
  });
});

describe("configuración de la granja y de los planes", () => {
  it("valida el nombre, los precios y el hashprice", async () => {
    const current = await settings.readSettings();
    await expect(admin.updateFarmSettings(actor, { ...current, name: "" })).rejects.toThrow(/nombre/);
    await expect(admin.updateFarmSettings(actor, { ...current, planPrices: { ...current.planPrices, h100: 50 } })).rejects.toThrow(/entre \$ 100/);
    await expect(admin.updateFarmSettings(actor, { ...current, satsPerThDay: 0 })).rejects.toThrow(/hashprice/);
    await expect(admin.updateFarmSettings(actor, { ...current, satsPerThDay: 42.25 })).rejects.toThrow(/un decimal/);
  });

  it("no deja bajar la capacidad por debajo de lo ya contratado", async () => {
    const current = await settings.readSettings();
    await expect(admin.updateFarmSettings(actor, { ...current, capacityTh: 200 })).rejects.toThrow(/ya contratados/);
    await expect(admin.updateFarmSettings(actor, { ...current, capacityTh: 50 })).rejects.toThrow(/entre 100/);
  });

  it("un precio o un hashprice nuevo aplica a los meses que se activen después; lo ya pagado conserva sus condiciones", async () => {
    vi.setSystemTime(T0 + 6 * DAY_MS);
    const minedBefore = (await portfolio.getPortfolio("a1")).minedSats;
    const current = await settings.readSettings();
    const next = await admin.updateFarmSettings(actor, { ...current, satsPerThDay: 45, planPrices: { ...current.planPrices, h100: 4800 } });
    expect(next).toMatchObject({ satsPerThDay: 45, planPrices: { h1000: 4200, h500: 4300, h250: 4450, h100: 4800 } });
    const catalog = await plans.getCatalog();
    expect(catalog.plans.find((p) => p.id === "h100")).toMatchObject({ priceCopPerThMonth: 4800, satsPerThDay: 45, monthlyCop: 480_000, dailySats: 4_500 });
    // a1 ya tenía sus dos meses pagados a 42 sats: el cambio no toca lo que ya mina.
    expect((await portfolio.getPortfolio("a1")).minedSats).toBe(minedBefore);
    expect((await plans.listSubscriptions("a1"))[0].periods.map((x) => x.satsPerThDay)).toEqual([42, 42]);
    vi.setSystemTime(T0);

    await pay.payWithTestPayment({ userId: "a3", planId: "h100" });
    const [a3] = await plans.listSubscriptions("a3");
    expect(a3).toMatchObject({ priceCopPerThMonth: 4800 });
    expect(a3.periods[0].satsPerThDay).toBe(45);
    expect((await plans.listSubscriptions("a1"))[0]).toMatchObject({ priceCopPerThMonth: 4450 });
    const entry = (await admin.listAudit(20)).find((e) => e.action === "config_granja");
    expect(entry?.summary).toMatch(/hashprice.*precios de los planes/);
  });
});

describe("cliente con datos personales", () => {
  it("puede comprar, buscarse por identidad y solicitar un retiro con su nombre registrado", async () => {
    const { saveProfile } = await import("@/lib/profile");
    const { createBtcWithdrawal } = await import("@/lib/withdrawals");
    await createUser("personal", { profile: false, name: "Alias de Google" });
    await saveProfile("personal", { fullName: "Mariana Restrepo", docType: "CC", docNumber: "1023456789", phone: "3001234567", city: "Medellín", acceptTerms: true });
    const tx = await admin.registerManualPayment(actor, { userId: "personal", planId: "h100", reference: "TRANSF-PERSONAL-1" });
    expect(tx).toMatchObject({ kind: "plan_mes", status: "confirmada", periodIndex: 1 });
    expect((await admin.listClients({ query: "Mariana Restrepo" })).map((c) => c.id)).toEqual(["personal"]);
    expect((await admin.listClients({ query: "1023456789" })).map((c) => c.id)).toEqual(["personal"]);
    try {
      vi.setSystemTime(T0 + 15 * DAY_MS);
      const w = await createBtcWithdrawal({ userId: "personal", amountSats: 60_000, address: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4" });
      expect((await admin.listWithdrawals()).find((item) => item.id === w.id)).toMatchObject({ fullName: "Mariana Restrepo", userName: "Alias de Google", companyName: "", nit: "", status: "por_aprobar" });
    } finally {
      vi.setSystemTime(T0);
    }
  });
});

describe("retiros para el admin", () => {
  it("los que esperan el envío van primero, aunque sean más antiguos que los ya revisados", async () => {
    const { db } = await import("@/lib/db");
    const { ledgerTx } = await import("@/lib/db/schema");
    await createUser("orden-retiros");
    const retiro = (id: string, status: "por_aprobar" | "confirmada" | "rechazada", daysAgo: number) => ({
      id,
      userId: "orden-retiros",
      kind: "retiro" as const,
      status,
      amountCop: 200_000,
      amountSats: 50_000,
      createdAt: T0 - daysAgo * DAY_MS,
    });
    await db.insert(ledgerTx).values([retiro("RET-VIEJO-PENDIENTE", "por_aprobar", 40), retiro("RET-NUEVO-PAGADO", "confirmada", 1), retiro("RET-NUEVO-RECHAZADO", "rechazada", 2)]);
    const list = (await admin.listWithdrawals()).filter((w) => w.userId === "orden-retiros").map((w) => w.id);
    expect(list).toEqual(["RET-VIEJO-PENDIENTE", "RET-NUEVO-PAGADO", "RET-NUEVO-RECHAZADO"]);
    const all = await admin.listWithdrawals();
    const firstReviewed = all.findIndex((w) => w.status !== "por_aprobar");
    expect(all.slice(firstReviewed).some((w) => w.status === "por_aprobar")).toBe(false);
  });
});

// Al final del archivo: este plan nuevo no debe cambiar los totales que comprueban las pruebas anteriores.
describe("cerrar un plan en revisión", () => {
  it("también se puede cerrar un plan con una devolución por conciliar: deja de minar y libera su capacidad", async () => {
    const { db } = await import("@/lib/db");
    const { paymentReview } = await import("@/lib/db/schema");
    await createUser("revision", { name: "Pago Devuelto S.A.S." });
    const { order } = await pay.payWithTestPayment({ userId: "revision", planId: "h100" });
    // La pasarela devolvió el pago: el plan queda en revisión hasta conciliar.
    await db.insert(paymentReview).values({ paymentId: order.id, userId: "revision", subscriptionId: order.subscriptionId!, occurredAt: T0 + DAY_MS, reason: "charged_back" });
    vi.setSystemTime(T0 + 2 * DAY_MS);
    try {
      const [sub] = await plans.listSubscriptions("revision");
      expect(plans.stateOf(sub, Date.now())).toBe("en_revision");
      const before = await plans.contractedTh();
      await admin.closeSubscription(actor, sub.id, "El banco desconoció el pago");
      expect(await plans.contractedTh()).toBe(before - 100);
      await expect(admin.closeSubscription(actor, sub.id, "otra vez")).rejects.toMatchObject({ status: 409 });
    } finally {
      vi.setSystemTime(T0);
    }
  });
});

describe("ficha de un cliente", () => {
  it("reúne sus pagos, lo que hizo el equipo en su cuenta y su último ingreso, sin mezclar otras cuentas", async () => {
    const { clientDetail } = await import("@/lib/admin/client-detail");
    const { db } = await import("@/lib/db");
    const { session } = await import("@/lib/db/schema");
    await db.insert(session).values([
      { id: "s-vieja", token: "t-vieja", userId: "a1", expiresAt: new Date(T0 - DAY_MS), createdAt: new Date(T0 - 3 * DAY_MS), updatedAt: new Date(T0 - 3 * DAY_MS) },
      { id: "s-nueva", token: "t-nueva", userId: "a1", expiresAt: new Date(T0 + DAY_MS), createdAt: new Date(T0 - 3_600_000), updatedAt: new Date(T0 - 3_600_000) },
      { id: "s-otra", token: "t-otra", userId: "a2", expiresAt: new Date(T0 + DAY_MS), createdAt: new Date(T0 - 60_000), updatedAt: new Date(T0 - 60_000) },
    ]);

    const d = await clientDetail("a1", T0);
    expect(d.client).toMatchObject({ id: "a1", name: "Textiles del Valle S.A.S." });
    // Último ingreso: la sesión más reciente; activas: solo las que no han vencido.
    expect(d.lastLoginAt).toBe(T0 - 3_600_000);
    expect(d.activeSessions).toBe(1);
    // Sus transferencias registradas, con la referencia del comprobante.
    expect(d.movements.filter((m) => m.method === "manual").map((m) => m.providerId)).toEqual(expect.arrayContaining(["TRANSF-0001", "TRANSF-0002"]));
    // La bitácora de su cuenta, de la más reciente a la más antigua, y nada de las otras empresas.
    const own = (await admin.listAudit(500)).filter((a) => a.targetUserId === "a1");
    expect(own.length).toBeGreaterThan(0);
    expect(d.activity.map((a) => a.id)).toEqual(own.slice(0, 60).map((a) => a.id));
    expect(d.requests).toEqual([]);

    const other = await clientDetail("a2", T0);
    expect(other.movements.some((m) => m.providerId === "TRANSF-0001")).toBe(false);
    expect(other.activity.every((a) => !own.some((o) => o.id === a.id))).toBe(true);
  });

  it("una cuenta que no existe da 404", async () => {
    const { clientDetail } = await import("@/lib/admin/client-detail");
    await expect(clientDetail("no-existe", T0)).rejects.toMatchObject({ status: 404 });
  });

  it("cerrar sus sesiones: deja de entrar de inmediato, queda en la bitácora y no aplica a la propia cuenta", async () => {
    const { closeClientSessions, clientDetail } = await import("@/lib/admin/client-detail");
    const { knownSession } = await import("@/lib/session");
    expect(await knownSession("a1", "s-nueva", T0)).toBe(true);
    // a1 tiene una sesión abierta y una vencida: se borran las dos y se cuenta la abierta.
    expect(await closeClientSessions(actor, "a1")).toEqual({ closed: 1 });
    expect(await knownSession("a1", "s-nueva", T0)).toBe(false);
    expect((await clientDetail("a1", T0)).activeSessions).toBe(0);
    // La de otro cliente sigue abierta.
    expect(await knownSession("a2", "s-otra", T0)).toBe(true);
    const [entry] = await admin.listAudit(1, { action: "cerrar_sesiones" });
    expect(entry).toMatchObject({ targetUserId: "a1", actorUserId: "admin-test", summary: "Cerró la sesión abierta de Textiles del Valle S.A.S.: tendrá que volver a ingresar" });
    await expect(closeClientSessions(actor, "admin-test")).rejects.toMatchObject({ status: 409 });
    await expect(closeClientSessions(actor, "no-existe")).rejects.toMatchObject({ status: 404 });
  });
});
