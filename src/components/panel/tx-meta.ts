import { formatAsset, formatSats, formatTh } from "@/lib/format";
import type { TxDTO } from "@/lib/portfolio";
import { paymentMethodLabel as methodName } from "@/lib/labels";
import { shortBtcAddress } from "@/lib/btc-address";

/** Hash de una transacción EVM (pagos con USDT o BNB). */
export const isEvmHash = (h: string | null | undefined): h is string => !!h && /^0x[0-9a-fA-F]{64}$/.test(h);
/** Txid de Bitcoin (retiros). */
export const isBtcTxid = (h: string | null | undefined): h is string => !!h && /^[0-9a-f]{64}$/.test(h);

/** Dónde seguir la transacción: mempool.space para un retiro en BTC, BscScan para un pago en cripto. */
export function explorerTxUrl(t: Pick<TxDTO, "txHash" | "chainId" | "kind" | "network">) {
  if (t.kind === "retiro" && isBtcTxid(t.txHash)) {
    return /testnet/i.test(t.network ?? "") ? `https://mempool.space/testnet/tx/${t.txHash}` : `https://mempool.space/tx/${t.txHash}`;
  }
  if (!isEvmHash(t.txHash)) return null;
  if (t.chainId === 97) return `https://testnet.bscscan.com/tx/${t.txHash}`;
  if (t.chainId === 56 || t.chainId == null) return `https://bscscan.com/tx/${t.txHash}`;
  return null;
}

export const methodLabel = (method: string | null): string => methodName(method) || "—";

/** El medio de un pago, avisando cuando no movió dinero real (credenciales de prueba o red de pruebas). */
export function paymentMethodLabel(t: Pick<TxDTO, "method" | "network" | "chainId" | "asset">) {
  if (t.method === "mercadopago") return /pruebas/i.test(t.network ?? "") ? "Mercado Pago (pruebas)" : "Mercado Pago";
  if (t.method === "crypto") return `Cripto${t.asset ? `, ${t.asset}` : ""}${t.chainId === 97 ? " (red de pruebas)" : ""}`;
  return methodLabel(t.method);
}

/** Qué fue el movimiento, en pocas palabras. */
export function txTitle(t: TxDTO) {
  if (t.kind === "retiro") return "Retiro en BTC";
  return t.periodIndex ? `Pago del mes ${t.periodIndex}` : "Pago de un plan";
}

/** El monto que se muestra: sats en un retiro, pesos en un pago. */
export function txAmount(t: TxDTO) {
  return t.kind === "retiro" && t.amountSats != null ? `−${formatSats(t.amountSats)}` : null;
}

/** El detalle: por dónde se pagó o a dónde va el retiro, o por qué no se completó. */
export function txDetail(t: TxDTO) {
  if ((t.status === "fallida" || t.status === "rechazada" || t.status === "por_reembolsar" || t.status === "reembolsada") && t.note) return t.note;
  if (t.kind === "retiro") return `A ${t.walletAddress ? shortBtcAddress(t.walletAddress) : "tu dirección Bitcoin"}${t.network && t.network !== "Bitcoin" ? `, ${t.network}` : ""}`;
  const parts = [paymentMethodLabel(t)];
  if (t.method === "crypto" && t.assetAmount != null && t.asset) parts.push(formatAsset(t.assetAmount, t.asset));
  if (t.hashrateTh) parts.push(formatTh(t.hashrateTh));
  if (t.status === "verificando" && t.providerStatus) parts.push(t.providerStatus);
  return parts.join(", ");
}
