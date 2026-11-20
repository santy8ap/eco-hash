import { describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { buildPayerProofMessage, verifyWalletSignature } from "@/lib/signing";

const account = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());
const issuedAt = Date.UTC(2026, 10, 4, 0, 5);

describe("mensajes que firma la wallet", () => {
  it("la prueba de propiedad nombra la wallet y la cuenta, así no sirve para otro usuario", () => {
    const msg = buildPayerProofMessage({ userId: "usuario-1", payer: account.address.toLowerCase(), issuedAt });
    expect(msg).toContain(account.address);
    expect(msg).toContain("usuario-1");
    expect(msg).not.toBe(buildPayerProofMessage({ userId: "usuario-2", payer: account.address, issuedAt }));
  });
});

describe("verificación de la firma de la wallet", () => {
  const message = buildPayerProofMessage({ userId: "usuario-1", payer: account.address, issuedAt });

  it("acepta la firma de la wallet dueña de la dirección", async () => {
    const signature = await account.signMessage({ message });
    expect(await verifyWalletSignature({ address: account.address, message, signature })).toBe(true);
  });

  it("rechaza la firma de otra wallet", async () => {
    const signature = await other.signMessage({ message });
    expect(await verifyWalletSignature({ address: account.address, message, signature })).toBe(false);
  });

  it("rechaza un mensaje alterado", async () => {
    const signature = await account.signMessage({ message });
    expect(await verifyWalletSignature({ address: account.address, message: message.replace("usuario-1", "usuario-2"), signature })).toBe(false);
  });

  it("no lanza error con una firma mal formada", async () => {
    expect(await verifyWalletSignature({ address: account.address, message: "x", signature: "0x1234" })).toBe(false);
  });
});
