import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ledgerTx } from "@/lib/db/schema";
import { GRACE_MS, minedSats, type SubscriptionState } from "@/lib/mining/plan-math";
import { summarize } from "@/lib/mining/summary";
import { listSubscriptions, periodsOf, stateOf, type SubscriptionWithPeriods } from "@/lib/plans/service";

/** Un movimiento del usuario: pago de un mes de un plan o retiro en BTC. */
export interface TxDTO {
  id: string;
  kind: string;
  status: string;
  amountCop: number;
  /** Sats de un retiro */
  amountSats: number | null;
  asset: string | null;
  assetAmount: number | null;
  network: string | null;
  /** Wallet que pagó en cripto, o la dirección Bitcoin de destino de un retiro */
  walletAddress: string | null;
  walletName: string | null;
  /** Hash del pago en cripto, o el txid del envío de un retiro */
  txHash: string | null;
  note: string | null;
  createdAt: number;
  confirmedAt: number | null;
  /** Pasarela de un pago: mercadopago, crypto, manual, transferencia o demo (pago de prueba) */
  method: string | null;
  providerStatus: string | null;
  chainId: number | null;
  subscriptionId: string | null;
  periodIndex: number | null;
  /** Hashrate del mes que paga una orden (TH/s) */
  hashrateTh: number | null;
}

export interface PeriodDTO {
  index: number;
  startsAt: number;
  endsAt: number;
  /** Hashprice de ese mes (sats por TH/s al día) */
  satsPerThDay: number;
}

export interface SubscriptionDTO {
  id: string;
  planId: string;
  planName: string;
  hashrateTh: number;
  months: number;
  monthlyCop: number;
  priceCopPerThMonth: number;
  state: SubscriptionState;
  paidMonths: number;
  periods: PeriodDTO[];
  startedAt: number | null;
  /** Fin del último mes pagado: cuándo hay que haber pagado el siguiente */
  paidUntil: number;
  /** Si está en pausa, hasta cuándo se puede pagar antes de que el plan se cierre */
  graceEndsAt: number | null;
  minedSats: number;
}

/**
 * Resumen del usuario. Los totales valen en `asOf`; con los periodos de cada plan el navegador los sigue
 * calculando en vivo con las mismas funciones (lib/mining).
 */
export interface PortfolioDTO {
  asOf: number;
  subscriptions: SubscriptionDTO[];
  minedSats: number;
  todaySats: number;
  /** Parte proporcional de las mensualidades del tiempo ya minado (COP) */
  costCop: number;
  /** Hashrate y sats por día de los planes activos en este momento */
  activeTh: number;
  dailySats: number;
  dailyCostCop: number;
  withdrawnSats: number;
  /** Retiros esperando al administrador */
  reservedSats: number;
  balanceSats: number;
  transactions: TxDTO[];
}

export function toSubscriptionDTO(sub: SubscriptionWithPeriods, now: number): SubscriptionDTO {
  const periods = periodsOf(sub);
  const state = stateOf(sub, now);
  const paidUntil = Math.max(...periods.map((p) => p.endsAt));
  return {
    id: sub.id,
    planId: sub.planId,
    planName: sub.planName,
    hashrateTh: sub.hashrateTh,
    months: sub.months,
    monthlyCop: Math.round(sub.hashrateTh * sub.priceCopPerThMonth),
    priceCopPerThMonth: sub.priceCopPerThMonth,
    state,
    paidMonths: sub.periods.length,
    periods,
    startedAt: sub.startedAt,
    paidUntil,
    graceEndsAt: state === "en_pausa" ? paidUntil + GRACE_MS : null,
    minedSats: minedSats(sub.hashrateTh, periods, now),
  };
}

export { summarize };

/** Retiros ya enviados y retiros en revisión (estos apartan sats hasta que el admin decida). */
async function withdrawalTotals(userId: string) {
  const [row] = await db
    .select({
      withdrawn: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'confirmada' then ${ledgerTx.amountSats} end), 0)`,
      reserved: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'por_aprobar' then ${ledgerTx.amountSats} end), 0)`,
    })
    .from(ledgerTx)
    .where(and(eq(ledgerTx.userId, userId), eq(ledgerTx.kind, "retiro")));
  return {
    withdrawn: Number(row?.withdrawn ?? 0),
    reserved: Number(row?.reserved ?? 0),
  };
}

/** Saldo disponible en sats: lo minado, menos lo retirado y lo que está en revisión. Nunca se redondea hacia arriba. */
export async function getBalance(userId: string, now = Date.now()) {
  const subs = (await listSubscriptions(userId)).map((s) => toSubscriptionDTO(s, now));
  const totals = summarize(subs, now);
  const w = await withdrawalTotals(userId);
  return {
    ...totals,
    ...w,
    balance: Math.max(0, Math.floor(totals.minedSats) - w.withdrawn - w.reserved),
  };
}

export async function getPortfolio(userId: string, now = Date.now()): Promise<PortfolioDTO> {
  const subscriptions = (await listSubscriptions(userId)).map((s) => toSubscriptionDTO(s, now));
  const totals = summarize(subscriptions, now);
  const w = await withdrawalTotals(userId);
  const txs = await db
    .select()
    .from(ledgerTx)
    .where(eq(ledgerTx.userId, userId))
    .orderBy(desc(ledgerTx.createdAt))
    .limit(60);
  return {
    asOf: now,
    subscriptions,
    ...totals,
    withdrawnSats: w.withdrawn,
    reservedSats: w.reserved,
    balanceSats: Math.max(0, Math.floor(totals.minedSats) - w.withdrawn - w.reserved),
    transactions: txs.map(toTxDTO),
  };
}

export function toTxDTO(t: typeof ledgerTx.$inferSelect): TxDTO {
  return {
    id: t.id,
    kind: t.kind,
    status: t.status,
    amountCop: t.amountCop,
    amountSats: t.amountSats ?? null,
    asset: t.asset,
    assetAmount: t.assetAmount,
    network: t.network,
    walletAddress: t.walletAddress,
    walletName: t.walletName,
    txHash: t.txHash,
    note: t.note ?? null,
    createdAt: t.createdAt,
    confirmedAt: t.confirmedAt,
    method: t.method ?? null,
    providerStatus: t.providerStatus ?? null,
    chainId: t.chainId ?? null,
    subscriptionId: t.subscriptionId ?? null,
    periodIndex: t.periodIndex ?? null,
    hashrateTh: t.hashrateTh ?? null,
  };
}
