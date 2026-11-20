import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createUser } from "../../tests/helpers";

const testDir = mkdtempSync(path.join(tmpdir(), "ech-receipts-"));
process.env.DATABASE_URL = `file:${path.join(testDir, "test.db")}`;
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");

let receipts: typeof import("@/lib/receipts");
let pay: typeof import("@/lib/payments/test-payment");
let dbModule: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let orderId: string;

beforeAll(async () => {
  receipts = await import("@/lib/receipts");
  pay = await import("@/lib/payments/test-payment");
  dbModule = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  await createUser("receipt-owner", { profile: false });
  const { saveProfile } = await import("@/lib/profile");
  await saveProfile("receipt-owner", {
    fullName: "Mariana Gómez Restrepo",
    docType: "CC",
    docNumber: "1036123456",
    phone: "3001234567",
    city: "Medellín",
    acceptTerms: true,
  });
  const result = await pay.payWithTestPayment({
    userId: "receipt-owner",
    planId: "h100",
  });
  orderId = result.order.id;
}, 120000);

describe("comprobantes del titular", () => {
  it("usa el precio del contrato, el hashrate y el hashprice que fijó ese mes, y avisa si no hubo dinero real", async () => {
    const receipt = await receipts.receiptData("receipt-owner", orderId);
    expect(receipt).toMatchObject({
      holder: "Mariana Gómez Restrepo",
      amountCop: 460000,
      priceCopPerThMonth: 4600,
      hashrateTh: 100,
      satsPerThDay: 42,
      amountSats: null,
      test: true,
    });
  });

  it("el comprobante de un retiro muestra los sats, la dirección y el txid", async () => {
    await dbModule.db.insert(schema.ledgerTx).values({
      id: "RET-RECEIPT01",
      userId: "receipt-owner",
      kind: "retiro",
      status: "confirmada",
      amountCop: 504000,
      amountSats: 120000,
      asset: "BTC",
      assetAmount: 0.0012,
      network: "Bitcoin",
      walletAddress: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
      txHash: "a".repeat(64),
      createdAt: Date.now(),
      confirmedAt: Date.now(),
    });
    const receipt = await receipts.receiptData("receipt-owner", "RET-RECEIPT01");
    expect(receipt).toMatchObject({
      kind: "retiro",
      amountSats: 120000,
      address: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
      reference: "a".repeat(64),
      hashrateTh: null,
    });
    const bytes = await receipts.renderReceipt(receipt);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
  it("rechaza movimientos ajenos y comprobantes de pagos pendientes", async () => {
    await expect(
      receipts.receiptData("another-user", orderId),
    ).rejects.toMatchObject({ status: 404 });
    await dbModule.db
      .insert(schema.ledgerTx)
      .values({
        id: "ECH-PENDING-RECEIPT",
        userId: "receipt-owner",
        kind: "plan_mes",
        status: "pendiente",
        amountCop: 460000,
        createdAt: Date.now(),
        method: "mercadopago",
      });
    await expect(
      receipts.receiptData("receipt-owner", "ECH-PENDING-RECEIPT"),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("genera un PDF válido con tildes y referencia real de la operación", async () => {
    const bytes = await receipts.renderReceipt(
      await receipts.receiptData("receipt-owner", orderId),
    );
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const { PDFDocument } = await import("pdf-lib");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
    if (process.env.ECH_RECEIPT_PREVIEW)
      writeFileSync(process.env.ECH_RECEIPT_PREVIEW, bytes);
  });
  it("no crea una orden cuando el usuario revisó un importe que ya cambió", async () => {
    await expect(
      pay.payWithTestPayment({
        userId: "receipt-owner",
        planId: "h100",
        expectedAmountCop: 1000000,
      }),
    ).rejects.toMatchObject({
      status: 409,
      extra: { code: "precio_actualizado" },
    });
    const { eq } = await import("drizzle-orm");
    const rows = await dbModule.db
      .select()
      .from(schema.ledgerTx)
      .where(eq(schema.ledgerTx.userId, "receipt-owner"));
    expect(rows).toHaveLength(3);
  });
});
