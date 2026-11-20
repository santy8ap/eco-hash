import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, type DbSession } from "@/lib/db";
import { writeTransaction } from "@/lib/db/transaction";
import { paymentReview, planPeriod, planSubscription } from "@/lib/db/schema";
import {
  GRACE_MS,
  nextPeriodWindow,
  reservesCapacity,
  subscriptionState,
  type Period,
  type SubscriptionState,
} from "@/lib/mining/plan-math";
import { MarketError } from "@/lib/errors";
import { newId, planCode } from "@/lib/ids";
import type { CatalogPlan } from "@/lib/farm-settings";
import { readConfig } from "@/lib/settings";

/**
 * Planes de hashrate: catálogo con la capacidad libre de la granja, qué mes se paga y la activación del periodo
 * cuando el pago se confirma. El estado de un plan nunca se guarda: se deriva de sus periodos.
 */

export type SubscriptionRow = typeof planSubscription.$inferSelect;
export type PeriodRow = typeof planPeriod.$inferSelect & {
  stoppedAt?: number | null;
};
export interface SubscriptionWithPeriods extends SubscriptionRow {
  periods: PeriodRow[];
  reviewRequired?: boolean;
}

/** Tolerancia al comparar TH/s (los planes son números enteros; esto solo cubre el redondeo). */
const EPS_TH = 1e-6;

/**
 * Los meses pagados de un plan, como ventanas de tiempo con su hashprice. Si el admin cerró el plan,
 * la minería se detiene en ese instante: los periodos se recortan ahí.
 */
export function periodsOf(sub: SubscriptionWithPeriods): Period[] {
  const cut = sub.cancelledAt;
  return sub.periods
    .filter((p) => cut == null || p.startsAt < cut)
    .map((p) => ({
      index: p.idx,
      startsAt: p.startsAt,
      endsAt: Math.max(
        p.startsAt,
        Math.min(p.endsAt, cut ?? Infinity, p.stoppedAt ?? Infinity),
      ),
      satsPerThDay: p.satsPerThDay,
    }));
}

export function stateOf(
  sub: SubscriptionWithPeriods,
  now = Date.now(),
): SubscriptionState {
  if (sub.reviewRequired) return "en_revision";
  return subscriptionState(sub, periodsOf(sub), now);
}

/**
 * TH/s que ya ocupan capacidad de la granja: planes activos o en pausa (dentro de los 15 días de gracia).
 * Es SQL puro para poder usarlo dentro de la sentencia que activa un periodo (ver activatePeriod).
 */
function reservedThSql(now: number, excludeSubscriptionId: string) {
  return sql`(
    SELECT coalesce(sum(s.hashrate_th), 0)
    FROM plan_subscription s
    JOIN (
      SELECT per.subscription_id, count(*) AS n,
        max(max(per.starts_at, min(per.ends_at, coalesce(r.occurred_at, per.ends_at)))) AS last_end
      FROM plan_period per LEFT JOIN payment_review r ON r.payment_id = per.tx_id
      GROUP BY per.subscription_id
    ) p ON p.subscription_id = s.id
    WHERE s.cancelled_at IS NULL
      AND s.id != ${excludeSubscriptionId}
      AND ((p.n >= s.months AND p.last_end > ${now}) OR (p.n < s.months AND p.last_end + ${GRACE_MS} >= ${now}))
  )`;
}

export async function contractedTh(
  now = Date.now(),
  excludeSubscriptionId = "",
) {
  const [row] = await db
    .select({
      th: sql<number>`${reservedThSql(now, excludeSubscriptionId)}`,
    })
    .from(sql`(SELECT 1)`);
  return Number(row?.th ?? 0);
}

async function withPeriods(
  subs: SubscriptionRow[],
  session: DbSession = db,
): Promise<SubscriptionWithPeriods[]> {
  if (!subs.length) return [];
  const periods = await session
    .select()
    .from(planPeriod)
    .where(
      inArray(
        planPeriod.subscriptionId,
        subs.map((s) => s.id),
      ),
    )
    .orderBy(asc(planPeriod.idx));
  const reviews = await session
    .select()
    .from(paymentReview)
    .where(
      inArray(
        paymentReview.subscriptionId,
        subs.map((s) => s.id),
      ),
    );
  const cutByPayment = new Map(reviews.map((r) => [r.paymentId, r.occurredAt]));
  const bySub = new Map<string, PeriodRow[]>();
  for (const p of periods)
    bySub.set(p.subscriptionId, [
      ...(bySub.get(p.subscriptionId) ?? []),
      { ...p, stoppedAt: cutByPayment.get(p.txId) ?? null },
    ]);
  return subs.map((s) => ({
    ...s,
    periods: bySub.get(s.id) ?? [],
    reviewRequired: reviews.some(
      (r) => r.subscriptionId === s.id && r.resolvedAt == null,
    ),
  }));
}

/** Planes del usuario que ya empezaron (los borradores sin pagar no se muestran). */
export async function listSubscriptions(
  userId: string,
): Promise<SubscriptionWithPeriods[]> {
  const subs = await db
    .select()
    .from(planSubscription)
    .where(eq(planSubscription.userId, userId))
    .orderBy(asc(planSubscription.createdAt));
  return (await withPeriods(subs)).filter((s) => s.periods.length > 0);
}

export async function listAllSubscriptions(): Promise<
  SubscriptionWithPeriods[]
> {
  const subs = await db
    .select()
    .from(planSubscription)
    .orderBy(asc(planSubscription.createdAt));
  return (await withPeriods(subs)).filter((s) => s.periods.length > 0);
}

export async function getSubscription(
  id: string,
  session: DbSession = db,
): Promise<SubscriptionWithPeriods | null> {
  const [sub] = await session
    .select()
    .from(planSubscription)
    .where(eq(planSubscription.id, id));
  return sub ? (await withPeriods([sub], session))[0] : null;
}

/** El catálogo vigente con la capacidad libre de la granja. */
export async function getCatalog(now = Date.now()) {
  const { settings, catalog, capacityTh } = await readConfig();
  const contracted = await contractedTh(now);
  const available = Math.max(0, capacityTh - contracted);
  return {
    /** Hora del servidor: el navegador sincroniza con ella sus contadores */
    asOf: now,
    farmName: settings.name,
    location: settings.location,
    satsPerThDay: settings.satsPerThDay,
    capacityTh,
    contractedTh: contracted,
    availableTh: available,
    plans: catalog.map((p) => ({
      ...p,
      available: p.hashrateTh <= available + EPS_TH,
    })),
  };
}

export type Catalog = Awaited<ReturnType<typeof getCatalog>>;

/** Qué paga una orden: un mes de un plan. */
export interface PlanPayment {
  subscriptionId: string;
  planId: string;
  planName: string;
  periodIndex: number;
  months: number;
  /** Hashrate del mes (TH/s) */
  hashrateTh: number;
  amountCop: number;
  priceCopPerThMonth: number;
}

const NO_CAPACITY =
  "La granja no tiene capacidad libre para ese plan en este momento. Elige un plan más pequeño o escríbenos.";

const monthOf = (
  sub: Pick<SubscriptionRow, "hashrateTh" | "priceCopPerThMonth">,
) => ({
  hashrateTh: sub.hashrateTh,
  amountCop: Math.round(sub.hashrateTh * sub.priceCopPerThMonth),
  priceCopPerThMonth: sub.priceCopPerThMonth,
});

/** El borrador sin pagar de ese plan, con los mismos precios de hoy, si ya existe. */
async function findDraft(session: DbSession, userId: string, plan: CatalogPlan) {
  const drafts = await session
    .select()
    .from(planSubscription)
    .where(
      and(
        eq(planSubscription.userId, userId),
        eq(planSubscription.planId, plan.id),
        sql`${planSubscription.startedAt} IS NULL`,
        sql`${planSubscription.cancelledAt} IS NULL`,
      ),
    )
    .orderBy(asc(planSubscription.createdAt));
  return drafts.find(
    (d) =>
      d.priceCopPerThMonth === plan.priceCopPerThMonth &&
      d.hashrateTh === plan.hashrateTh &&
      d.months === plan.months,
  );
}

/**
 * El plan en borrador que paga el primer mes. Abandonar un pago y volver a intentarlo reutiliza el mismo borrador
 * (no deja basura), y dos solicitudes a la vez (doble clic, dos pestañas) también: la creación va en una
 * transacción de escritura.
 */
async function draftFor(userId: string, plan: CatalogPlan, now: number) {
  const existing = await findDraft(db, userId, plan);
  if (existing) return existing;
  return writeTransaction(async (session) => {
    const same = await findDraft(session, userId, plan);
    if (same) return same;
    const [row] = await session
      .insert(planSubscription)
      .values({
        id: planCode(),
        userId,
        planId: plan.id,
        planName: plan.name,
        hashrateTh: plan.hashrateTh,
        months: plan.months,
        priceCopPerThMonth: plan.priceCopPerThMonth,
        createdAt: now,
      })
      .returning();
    return row;
  });
}

/**
 * Valida qué se va a pagar y calcula el monto: el primer mes de un plan nuevo (`planId`)
 * o el mes siguiente de un plan que ya tiene el usuario (`subscriptionId`).
 */
export async function resolvePlanPayment(
  userId: string,
  input: { planId?: string; subscriptionId?: string },
  now = Date.now(),
): Promise<PlanPayment> {
  if (input.subscriptionId) {
    const sub = await getSubscription(input.subscriptionId);
    if (!sub || sub.userId !== userId)
      throw new MarketError("No encontramos ese plan en tu cuenta", 404);
    const state = stateOf(sub, now);
    if (state === "en_revision")
      throw new MarketError(
        "Este plan tiene una devolución en revisión. Contacta a soporte antes de pagar otro mes.",
        409,
      );
    if (state === "completada")
      throw new MarketError("Este plan ya tiene todos sus meses pagados.", 409);
    if (state === "vencida" || state === "cancelada")
      throw new MarketError(
        "Este plan se cerró. Compra un plan nuevo para seguir minando.",
        409,
      );
    if (
      state === "borrador" &&
      (await contractedTh(now)) + sub.hashrateTh >
        (await readConfig()).capacityTh + EPS_TH
    )
      throw new MarketError(NO_CAPACITY, 409);
    return {
      subscriptionId: sub.id,
      planId: sub.planId,
      planName: sub.planName,
      periodIndex: sub.periods.length + 1,
      months: sub.months,
      ...monthOf(sub),
    };
  }

  const { catalog, capacityTh } = await readConfig();
  const plan = catalog.find((p) => p.id === input.planId);
  if (!plan) throw new MarketError("Elige uno de los planes disponibles");
  if ((await contractedTh(now)) + plan.hashrateTh > capacityTh + EPS_TH)
    throw new MarketError(NO_CAPACITY, 409);
  const draft = await draftFor(userId, plan, now);
  return {
    subscriptionId: draft.id,
    planId: draft.planId,
    planName: draft.planName,
    periodIndex: 1,
    months: draft.months,
    ...monthOf(draft),
  };
}

export type ActivationOutcome =
  | "activado"
  | "sin_cupo"
  | "mes_pagado"
  | "plan_cerrado"
  | "plan_en_revision";

function isUniqueViolation(err: unknown) {
  return (
    /UNIQUE/i.test(String((err as { message?: string })?.message ?? err)) ||
    /UNIQUE/i.test(String((err as { cause?: unknown })?.cause ?? ""))
  );
}

/**
 * Activa el mes que pagó una orden, con el hashprice vigente. El periodo se inserta con una sola sentencia que
 * comprueba la capacidad: dos pagos que llegan a la vez no pueden vender el mismo hashrate dos veces.
 */
export async function activatePeriod(
  order: {
    id: string;
    subscriptionId: string | null;
    periodIndex: number | null;
    amountCop: number;
    hashrateTh: number | null;
  },
  now = Date.now(),
  context?: { session: DbSession; capacityTh: number; satsPerThDay: number },
): Promise<ActivationOutcome> {
  const session = context?.session ?? db;
  const sub = order.subscriptionId
    ? await getSubscription(order.subscriptionId, session)
    : null;
  if (!sub || sub.cancelledAt != null) return "plan_cerrado";
  if (sub.reviewRequired) return "plan_en_revision";
  // Conserva las fechas de otros períodos pagados y usa el corte efectivo del período devuelto.
  const window = nextPeriodWindow(periodsOf(sub), now);
  if (sub.periods.length >= sub.months || order.periodIndex !== window.index)
    return "mes_pagado";

  // Un plan activo o en pausa ya tiene su capacidad apartada; uno nuevo (o vencido) la pide ahora.
  const holdsCapacity = reservesCapacity(stateOf(sub, now));
  const config = context
    ? { capacityTh: context.capacityTh, satsPerThDay: context.satsPerThDay }
    : await readConfig().then((c) => ({ capacityTh: c.capacityTh, satsPerThDay: c.settings.satsPerThDay }));
  const fits = holdsCapacity
    ? sql`1 = 1`
    : sql`${reservedThSql(now, sub.id)} + ${sub.hashrateTh} <= ${config.capacityTh + EPS_TH}`;
  const hashrateTh = order.hashrateTh ?? sub.hashrateTh;
  try {
    const res = await session.run(sql`
      INSERT INTO plan_period (id, subscription_id, idx, starts_at, ends_at, hashrate_th, sats_per_th_day, amount_cop, tx_id, created_at)
      SELECT ${newId("per-")}, ${sub.id}, ${window.index}, ${window.startsAt}, ${window.endsAt}, ${hashrateTh}, ${config.satsPerThDay}, ${order.amountCop}, ${order.id}, ${now}
      WHERE ${fits}
    `);
    if (!res.rowsAffected) return "sin_cupo";
  } catch (err) {
    if (isUniqueViolation(err)) return "mes_pagado";
    throw err;
  }
  if (sub.startedAt == null)
    await session
      .update(planSubscription)
      .set({ startedAt: now })
      .where(
        and(
          eq(planSubscription.id, sub.id),
          sql`${planSubscription.startedAt} IS NULL`,
        ),
      );
  return "activado";
}
