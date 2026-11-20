import { getAddress, isAddress, verifyMessage, type Hex } from "viem";
import { BRAND } from "@/config/brand";

/**
 * Prueba de que la wallet que va a pagar con cripto es del usuario: sin ella, alguien podría
 * cotizar con la dirección de otra persona y reclamar su pago como propio.
 */
export function buildPayerProofMessage(p: { userId: string; payer: string; issuedAt: number }) {
  return [
    `${BRAND.name} — Confirmo que esta wallet es mía y la uso para pagar en ${BRAND.name}.`,
    ``,
    `Wallet: ${isAddress(p.payer) ? getAddress(p.payer) : p.payer}`,
    `Cuenta: ${p.userId}`,
    `Fecha: ${new Date(p.issuedAt).toISOString()}`,
    ``,
    `Esta firma no mueve fondos.`,
  ].join("\n");
}

/** Verifica que `signature` sea la firma EIP-191 de `message` hecha por `address`. */
export async function verifyWalletSignature(p: { address: string; message: string; signature: string }) {
  if (!isAddress(p.address) || !/^0x[0-9a-fA-F]+$/.test(p.signature)) return false;
  try {
    return await verifyMessage({ address: p.address, message: p.message, signature: p.signature as Hex });
  } catch {
    return false;
  }
}
