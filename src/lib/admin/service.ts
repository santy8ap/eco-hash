import "server-only";
import { hasPersonalDetails } from "@/lib/profile-schema";
import { and, desc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { FARM } from "@/config/farm";
import { db } from "@/lib/db";
import {
  adminAudit,
  companyProfile,
  dataRequest,
  ledgerTx,
  paymentReview,
  farm,
  planSubscription,
  user,
  type AdminAction,
} from "@/lib/db/schema";
import { monthKey, monthStartMs } from "./analytics";
import { audit, type Actor } from "./audit";
import { DAY_MS } from "@/lib/time";
import { env, isDemoMode } from "@/lib/env";
import { MarketError } from "@/lib/errors";
import { formatCop, formatSats } from "@/lib/format";
import { orderCode, simulatedBtcTxid } from "@/lib/ids";
import { fulfillOrder } from "@/lib/orders";
import { emailWithdrawalDecided } from "@/lib/customer-email";
import { bankReferenceOwner } from "@/lib/payments/bank-reference";
import { collectedWhere } from "@/lib/payments/real-money";
import {
  noPaymentReviewSql,
  requireNoPaymentReview,
} from "@/lib/payments/reversals";
import {
  contractedTh,
  getSubscription,
  listAllSubscriptions,
  resolvePlanPayment,
  stateOf,
} from "@/lib/plans/service";
import { validateSettings, type FarmSettings } from "@/lib/farm-settings";
import { summarize, toSubscriptionDTO, toTxDTO, type SubscriptionDTO } from "@/lib/portfolio";
import { TERMS_VERSION, requireCompleteProfile } from "@/lib/profile";
import { invalidateSettings, readConfig, readSettings } from "@/lib/settings";

// La bitácora vive en su propio módulo (lo usan también el perfil y los pagos); se sigue exportando desde aquí.
export { audit, type Actor };

/** La bitácora, de lo más reciente a lo más antiguo; `action` deja un tipo y `query` busca en el texto y en quién lo hizo. */
export async function listAudit(limit = 50, { action, query = "", targetUserId }: { action?: string; query?: string; targetUserId?: string } = {}) {
  await readSettings();
  const q = query.trim().slice(0, 80);
  // rowid desempata las acciones registradas en el mismo milisegundo: siempre la más reciente primero.
  return db
    .select()
    .from(adminAudit)
    .where(
      and(
        action ? eq(adminAudit.action, action as AdminAction) : undefined,
        q ? or(like(adminAudit.summary, `%${q}%`), like(adminAudit.actorName, `%${q}%`)) : undefined,
        targetUserId ? eq(adminAudit.targetUserId, targetUserId) : undefined,
      ),
    )
    .orderBy(desc(adminAudit.createdAt), desc(sql`rowid`))
    .limit(Math.min(Math.max(limit, 1), 500));
}

/* ───────────── Clientes ───────────── */

function profileOf(p: typeof companyProfile.$inferSelect | undefined) {
  if (!p) return null;
  return {
    companyName: p.companyName,
    nit: p.nit,
    fullName: p.fullName,
    docType: p.docType,
    docNumber: p.docNumber,
    phone: p.phone,
    city: p.city,
    termsAcceptedAt: p.termsAcceptedAt,
    termsCurrent:
      p.termsVersion === TERMS_VERSION &&
      p.termsAcceptedAt != null &&
      hasPersonalDetails(p),
  };
}

/** Retiros enviados y en revisión de cada usuario, en sats. */
export async function withdrawalsByUser() {
  const rows = await db
    .select({
      userId: ledgerTx.userId,
      withdrawn: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'confirmada' then ${ledgerTx.amountSats} end), 0)`,
      reserved: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'por_aprobar' then ${ledgerTx.amountSats} end), 0)`,
    })
    .from(ledgerTx)
    .where(eq(ledgerTx.kind, "retiro"))
    .groupBy(ledgerTx.userId);
  return new Map(
    rows.map((r) => [
      r.userId,
      { withdrawn: Number(r.withdrawn), reserved: Number(r.reserved) },
    ]),
  );
}

/**
 * Los sats minados por cada cliente, redondeados hacia abajo como en su saldo. Se suma cliente por cliente
 * (no el total de una vez) para que «Se les debe» sea exactamente la suma de los saldos más los retiros por enviar.
 */
export function minedByUser(subs: readonly { userId: string }[], plans: readonly SubscriptionDTO[], now: number) {
  const byUser = new Map<string, SubscriptionDTO[]>();
  subs.forEach((s, i) => byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), plans[i]]));
  return new Map([...byUser].map(([userId, list]) => [userId, Math.floor(summarize(list, now).minedSats)]));
}

/** Los clientes registrados, con sus planes, sus sats y su saldo. Con `userId`, solo esa cuenta. */
export async function listClients({ query = "", userId }: { query?: string; userId?: string } = {}) {
  const now = Date.now();
  const q = query.trim();
  const matching = q
    ? await db
        .select({ id: user.id })
        .from(user)
        .leftJoin(companyProfile, eq(companyProfile.userId, user.id))
        .where(
          or(
            like(user.name, `%${q}%`),
            like(user.email, `%${q}%`),
            like(companyProfile.fullName, `%${q}%`),
            like(companyProfile.docNumber, `%${q}%`),
            like(companyProfile.companyName, `%${q}%`),
            like(companyProfile.nit, `%${q}%`),
          ),
        )
    : null;
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(
      and(
        matching ? inArray(user.id, matching.length ? matching.map((m) => m.id) : [""]) : undefined,
        userId ? eq(user.id, userId) : undefined,
      ),
    )
    .orderBy(desc(user.createdAt));
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const profiles = new Map(
    (
      await db
        .select()
        .from(companyProfile)
        .where(inArray(companyProfile.userId, ids))
    ).map((p) => [p.userId, p]),
  );
  const subs = await listAllSubscriptions();
  const money = await withdrawalsByUser();
  // Por cliente: transferencias que esperan confirmación y la fecha de su último pago confirmado.
  const activity = new Map(
    (
      await db
        .select({
          userId: ledgerTx.userId,
          openTransfers: sql<number>`sum(case when ${ledgerTx.method} = 'transferencia' and ${ledgerTx.status} in ('pendiente', 'verificando') then 1 else 0 end)`,
          lastPaymentAt: sql<number | null>`max(case when ${ledgerTx.status} = 'confirmada' then coalesce(${ledgerTx.confirmedAt}, ${ledgerTx.createdAt}) end)`,
        })
        .from(ledgerTx)
        .where(and(eq(ledgerTx.kind, "plan_mes"), inArray(ledgerTx.userId, ids)))
        .groupBy(ledgerTx.userId)
    ).map((a) => [a.userId, a]),
  );

  // Solicitudes de eliminación de datos personales que esperan respuesta.
  const requests = new Map(
    (
      await db
        .select()
        .from(dataRequest)
        .where(and(inArray(dataRequest.userId, ids), eq(dataRequest.status, "pendiente")))
    ).map((d) => [d.userId, d]),
  );

  return rows
    .map((r) => {
      const plans = subs
        .filter((s) => s.userId === r.id)
        .map((s) => toSubscriptionDTO(s, now));
      const totals = summarize(plans, now);
      const w = money.get(r.id) ?? { withdrawn: 0, reserved: 0 };
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        createdAt: r.createdAt.getTime(),
        profile: profileOf(profiles.get(r.id)),
        plans,
        minedSats: Math.floor(totals.minedSats),
        activeTh: totals.activeTh,
        costCop: Math.floor(totals.costCop),
        withdrawnSats: w.withdrawn,
        reservedSats: w.reserved,
        openTransfers: Number(activity.get(r.id)?.openTransfers ?? 0),
        lastPaymentAt: activity.get(r.id)?.lastPaymentAt ?? null,
        deletionRequest: (() => {
          const d = requests.get(r.id);
          return d ? { id: d.id, createdAt: d.createdAt, dueAt: d.dueAt, reason: d.reason, blockers: [] as string[] } : null;
        })(),
        balanceSats: Math.max(
          0,
          Math.floor(totals.minedSats) - w.withdrawn - w.reserved,
        ),
      };
    })
    .sort(
      (a, b) => b.plans.length - a.plans.length || b.createdAt - a.createdAt,
    );
}

/**
 * Registra un pago que llegó por fuera de la plataforma (por ejemplo, una transferencia bancaria)
 * y activa el mes. La referencia del comprobante no puede usarse dos veces.
 */
export async function registerManualPayment(
  actor: Actor,
  input: {
    userId: string;
    planId?: string;
    subscriptionId?: string;
    reference: string;
  },
) {
  const reference = input.reference.trim().slice(0, 120);
  if (reference.length < 4)
    throw new MarketError(
      "Escribe la referencia del pago: el número del comprobante o de la transferencia.",
    );
  const [target] = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.id, input.userId));
  if (!target) throw new MarketError("Cliente no encontrado", 404);
  const profile = await requireCompleteProfile(input.userId).catch(() => {
    throw new MarketError(
      "Este cliente todavía no completa sus datos personales ni acepta los términos. Pídele que lo haga antes de registrar el pago.",
      412,
    );
  });
  // La misma referencia no puede acreditar dos pagos: ni otro registrado a mano ni una transferencia confirmada.
  if (await bankReferenceOwner(reference))
    throw new MarketError("Esa referencia ya se registró para otro pago.", 409);
  const now = Date.now();
  const p = await resolvePlanPayment(
    input.userId,
    { planId: input.planId, subscriptionId: input.subscriptionId },
    now,
  );
  const orderId = orderCode();
  try {
    await db.insert(ledgerTx).values({
      id: orderId,
      userId: input.userId,
      kind: "plan_mes",
      status: "pendiente",
      amountCop: p.amountCop,
      asset: "COP",
      walletName: "Transferencia bancaria",
      createdAt: now,
      method: "manual",
      providerId: reference,
      subscriptionId: p.subscriptionId,
      periodIndex: p.periodIndex,
      hashrateTh: p.hashrateTh,
    });
  } catch (err) {
    if (
      /UNIQUE/i.test(
        String((err as Error)?.message ?? err) +
          String((err as { cause?: unknown })?.cause ?? ""),
      )
    ) {
      throw new MarketError(
        "Esa referencia ya se registró para otro pago.",
        409,
      );
    }
    throw err;
  }
  const r = await fulfillOrder(
    orderId,
    { providerStatus: "registrado por el administrador" },
    { now },
  );
  if (r.outcome !== "confirmada")
    throw new MarketError(r.order.note ?? "No se pudo activar el plan.", 409);
  await audit(
    actor,
    "pago_manual",
    `Registró el pago de ${formatCop(p.amountCop)} de ${profile.companyName || profile.fullName}: ${p.planName}, mes ${p.periodIndex} de ${p.months} (ref. ${reference})`,
    {
      orderId,
      subscriptionId: p.subscriptionId,
      periodIndex: p.periodIndex,
      amountCop: p.amountCop,
      reference,
    },
    input.userId,
  );
  return toTxDTO(r.order);
}

/** Cierra un plan antes de tiempo (por ejemplo, si su pago fue devuelto): deja de minar y libera su capacidad. */
export async function closeSubscription(
  actor: Actor,
  subscriptionId: string,
  reasonInput: string,
) {
  const reason = reasonInput.trim().slice(0, 200);
  if (reason.length < 4) throw new MarketError("Escribe el motivo del cierre.");
  const sub = await getSubscription(subscriptionId);
  if (!sub || !sub.periods.length)
    throw new MarketError("Plan no encontrado", 404);
  const now = Date.now();
  const state = stateOf(sub, now);
  // También en revisión: un pago devuelto es justo el caso en que el plan se cierra.
  if (sub.cancelledAt != null || !["activa", "en_pausa", "en_revision"].includes(state))
    throw new MarketError("Este plan ya terminó o ya estaba cerrado.", 409);
  const res = await db
    .update(planSubscription)
    .set({ cancelledAt: now })
    .where(
      and(
        eq(planSubscription.id, subscriptionId),
        sql`${planSubscription.cancelledAt} IS NULL`,
      ),
    )
    .returning({ id: planSubscription.id });
  if (!res.length) throw new MarketError("Este plan ya estaba cerrado.", 409);
  const [who] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, sub.userId));
  await audit(
    actor,
    "cerrar_plan",
    `Cerró el ${sub.planName} (${sub.id}) de ${who?.name ?? "un cliente"}: ${reason}`,
    { subscriptionId, reason, paidMonths: sub.periods.length },
    sub.userId,
  );
  return { id: subscriptionId, cancelledAt: now };
}

/* ───────────── Retiros ───────────── */

/** Un txid de Bitcoin: 32 bytes en hexadecimal. */
const TXID = /^[0-9a-f]{64}$/;

/** Los retiros para el admin: primero todos los que esperan el envío, después los ya revisados más recientes. */
export async function listWithdrawals({ limit = 200 }: { limit?: number } = {}) {
  await readSettings();
  const rows = await db
    .select({
      tx: ledgerTx,
      userName: user.name,
      userEmail: user.email,
      fullName: companyProfile.fullName,
      companyName: companyProfile.companyName,
      nit: companyProfile.nit,
      docType: companyProfile.docType,
      docNumber: companyProfile.docNumber,
    })
    .from(ledgerTx)
    .innerJoin(user, eq(user.id, ledgerTx.userId))
    .leftJoin(companyProfile, eq(companyProfile.userId, ledgerTx.userId))
    .where(
      and(
        eq(ledgerTx.kind, "retiro"),
        inArray(ledgerTx.status, ["por_aprobar", "confirmada", "rechazada"]),
      ),
    )
    // Un retiro por pagar nunca se queda por fuera de la lista, por antiguo que sea.
    .orderBy(sql`case when ${ledgerTx.status} = 'por_aprobar' then 0 else 1 end`, desc(ledgerTx.createdAt))
    .limit(Math.min(Math.max(limit, 1), 10_000));
  return rows.map((r) => ({
    ...toTxDTO(r.tx),
    userId: r.tx.userId,
    userName: r.userName,
    userEmail: r.userEmail,
    fullName: r.fullName ?? null,
    companyName: r.companyName ?? null,
    nit: r.nit ?? null,
    customerId: r.nit || (r.docNumber ? `${r.docType ?? ""} ${r.docNumber}`.trim() : null),
  }));
}

/**
 * Aprueba o rechaza un retiro. Aprobar exige el txid del envío en la red de Bitcoin (64 caracteres
 * hexadecimales); en modo de pruebas, si se deja vacío, se genera uno simulado.
 */
export async function decideWithdrawal(
  actor: Actor,
  txId: string,
  decision: "aprobar" | "rechazar",
  reason = "",
  reference = "",
) {
  const now = Date.now();
  const [tx] = await db
    .select()
    .from(ledgerTx)
    .where(and(eq(ledgerTx.id, txId), eq(ledgerTx.kind, "retiro")));
  if (!tx) throw new MarketError("Retiro no encontrado", 404);
  if (tx.status !== "por_aprobar")
    throw new MarketError("Este retiro ya fue revisado", 409);
  const [who] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, tx.userId));

  if (decision === "aprobar") {
    await requireNoPaymentReview(tx.userId);
    // El saldo ya quedó apartado cuando el usuario pidió el retiro.
    const ref = reference.trim().toLowerCase();
    if (ref && !TXID.test(ref))
      throw new MarketError("El txid debe tener 64 caracteres hexadecimales (0-9 y a-f). Cópialo de tu billetera o de un explorador de bloques.");
    if (!ref && !isDemoMode())
      throw new MarketError("Escribe el txid del envío en la red de Bitcoin (64 caracteres).");
    const txHash = ref || simulatedBtcTxid();
    const res = await db
      .update(ledgerTx)
      .set({ status: "confirmada", txHash, confirmedAt: now })
      .where(
        and(
          eq(ledgerTx.id, txId),
          eq(ledgerTx.status, "por_aprobar"),
          noPaymentReviewSql(tx.userId),
        ),
      )
      .returning();
    if (!res.length) throw new MarketError("Este retiro ya fue revisado", 409);
    emailWithdrawalDecided(tx.userId, res[0]);
    await audit(
      actor,
      "aprobar_retiro",
      `Aprobó el retiro de ${formatSats(tx.amountSats ?? 0)} de ${who?.name ?? "un cliente"}`,
      { txId, txid: txHash },
      tx.userId,
    );
    return toTxDTO(res[0]);
  }

  const note = reason.trim().slice(0, 200) || "Rechazado por el administrador";
  const res = await db
    .update(ledgerTx)
    .set({ status: "rechazada", note, confirmedAt: now })
    .where(and(eq(ledgerTx.id, txId), eq(ledgerTx.status, "por_aprobar")))
    .returning();
  if (!res.length) throw new MarketError("Este retiro ya fue revisado", 409);
  emailWithdrawalDecided(tx.userId, res[0]);
  await audit(
    actor,
    "rechazar_retiro",
    `Rechazó el retiro de ${formatSats(tx.amountSats ?? 0)} de ${who?.name ?? "un cliente"}: ${note}`,
    { txId, reason: note },
    tx.userId,
  );
  return toTxDTO(res[0]);
}

/* ───────────── Granja y planes ───────────── */

const SETTING_LABELS: Record<string, string> = {
  name: "nombre",
  location: "ubicación",
  capacityTh: "capacidad",
  satsPerThDay: "hashprice",
  planPrices: "precios de los planes",
};

export async function updateFarmSettings(actor: Actor, next: FarmSettings) {
  const current = await readSettings();
  const problem = validateSettings(next, { contractedTh: await contractedTh() });
  if (problem) throw new MarketError(problem);
  await db
    .update(farm)
    .set({
      name: next.name.trim(),
      location: next.location.trim(),
      capacityTh: next.capacityTh,
      satsPerThDay: next.satsPerThDay,
      planPrices: JSON.stringify(next.planPrices),
      updatedAt: Date.now(),
    })
    .where(eq(farm.id, FARM.id));
  invalidateSettings();

  const same = (k: string) =>
    JSON.stringify(current[k as keyof FarmSettings]) ===
    JSON.stringify(next[k as keyof FarmSettings]);
  const changed = Object.keys(SETTING_LABELS).filter((k) => !same(k));
  if (changed.length) {
    await audit(
      actor,
      "config_granja",
      `Cambió ${changed.map((k) => SETTING_LABELS[k]).join(", ")}`,
      {
        before: Object.fromEntries(
          changed.map((k) => [k, current[k as keyof FarmSettings]]),
        ),
        after: Object.fromEntries(
          changed.map((k) => [k, next[k as keyof FarmSettings]]),
        ),
      },
    );
  }
  return readSettings();
}

/* ───────────── Resumen ───────────── */

export async function adminOverview() {
  const { settings, capacityTh } = await readConfig();
  const now = Date.now();
  const subs = await listAllSubscriptions();
  const plans = subs.map((s) => toSubscriptionDTO(s, now));
  const live = plans.filter(
    (p) => p.state === "activa" || p.state === "en_pausa",
  );
  const totals = summarize(plans, now);
  // El mismo cálculo con el que se venden los planes: incluye los que están en pausa o en conciliación
  // mientras conservan su capacidad.
  const contracted = await contractedTh(now);
  const [w] = await db
    .select({
      pending: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'por_aprobar' then 1 else 0 end), 0)`,
      pendingSats: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'por_aprobar' then ${ledgerTx.amountSats} end), 0)`,
      paidSats: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'confirmada' then ${ledgerTx.amountSats} end), 0)`,
    })
    .from(ledgerTx)
    .where(eq(ledgerTx.kind, "retiro"));
  const [p] = await db
    .select({
      collectedCop: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'confirmada' then ${ledgerTx.amountCop} end), 0)`,
      toRefund: sql<number>`coalesce(sum(case when ${ledgerTx.status} = 'por_reembolsar' then 1 else 0 end), 0)`,
    })
    .from(ledgerTx)
    .where(and(eq(ledgerTx.kind, "plan_mes"), collectedWhere()));
  // Transferencias que reportaron los clientes y esperan que el admin las busque en el banco.
  const [t] = await db
    .select({ n: sql<number>`count(*)` })
    .from(ledgerTx)
    .where(
      and(
        eq(ledgerTx.kind, "plan_mes"),
        eq(ledgerTx.method, "transferencia"),
        inArray(ledgerTx.status, ["pendiente", "verificando"]),
      ),
    );
  // Recaudo de este mes y del anterior, en hora de Colombia.
  const thisMonth = monthStartMs(monthKey(now));
  const lastMonth = monthStartMs(monthKey(thisMonth - DAY_MS));
  const at = sql`coalesce(${ledgerTx.confirmedAt}, ${ledgerTx.createdAt})`;
  const [m] = await db
    .select({
      current: sql<number>`coalesce(sum(case when ${at} >= ${thisMonth} then ${ledgerTx.amountCop} end), 0)`,
      previous: sql<number>`coalesce(sum(case when ${at} >= ${lastMonth} and ${at} < ${thisMonth} then ${ledgerTx.amountCop} end), 0)`,
    })
    .from(ledgerTx)
    .where(and(eq(ledgerTx.kind, "plan_mes"), eq(ledgerTx.status, "confirmada"), collectedWhere()));
  // Devoluciones de Mercado Pago que esperan la conciliación del admin.
  const [r] = await db
    .select({ n: sql<number>`count(*)` })
    .from(paymentReview)
    .where(isNull(paymentReview.resolvedAt));
  const [u] = await db
    .select({ n: sql<number>`count(*)` })
    .from(user)
    .where(sql`lower(${user.email}) <> ${env.demoEmail}`);
  const [dr] = await db
    .select({ n: sql<number>`count(*)` })
    .from(dataRequest)
    .where(eq(dataRequest.status, "pendiente"));
  const paidOut = Number(w?.paidSats ?? 0);
  // Por cliente, igual que su saldo: lo minado menos lo que ya se le envió.
  const money = await withdrawalsByUser();
  const mined = minedByUser(subs, plans, now);
  let minedSats = 0;
  let owedSats = 0;
  for (const [userId, sats] of mined) {
    minedSats += sats;
    owedSats += Math.max(0, sats - (money.get(userId)?.withdrawn ?? 0));
  }
  return {
    settings,
    capacityTh,
    contractedTh: contracted,
    availableTh: Math.max(0, capacityTh - contracted),
    /** Hashrate minando ahora mismo y sats que suma por día */
    activeTh: totals.activeTh,
    dailySats: totals.dailySats,
    activePlans: plans.filter((x) => x.state === "activa").length,
    pausedPlans: plans.filter((x) => x.state === "en_pausa").length,
    clients: new Set(live.map((x) => subs.find((s) => s.id === x.id)?.userId))
      .size,
    /** Mensualidades cobradas. Incluye los pagos de prueba solo mientras el modo de pruebas está activo. */
    collectedCop: Number(p?.collectedCop ?? 0),
    minedSats,
    /** Los sats que eco-hash les debe a sus clientes: sus saldos más los retiros que esperan el envío */
    owedSats,
    paidOutSats: paidOut,
    pendingWithdrawals: Number(w?.pending ?? 0),
    pendingWithdrawalsSats: Number(w?.pendingSats ?? 0),
    paymentsToRefund: Number(p?.toRefund ?? 0),
    transfersToConfirm: Number(t?.n ?? 0),
    /** Devoluciones que requieren conciliación antes de que el cliente pueda retirar */
    reviewsPending: Number(r?.n ?? 0),
    /** Planes minando cuyo mes vence en los próximos 7 días y les falta pagar meses */
    dueSoon: plans.filter((x) => x.state === "activa" && x.paidMonths < x.months && x.paidUntil - now <= 7 * DAY_MS).length,
    monthCollectedCop: Number(m?.current ?? 0),
    previousMonthCollectedCop: Number(m?.previous ?? 0),
    /** Cuentas registradas, sin la de pruebas */
    registeredClients: Number(u?.n ?? 0),
    /** Solicitudes de eliminación de datos personales sin responder (plazo legal de 15 días hábiles) */
    dataRequests: Number(dr?.n ?? 0),
    recent: await listAudit(8),
  };
}
