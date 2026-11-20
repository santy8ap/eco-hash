import { PLAN_MONTHS } from "@/config/plans";
import { DAY_MS, dayStartMs, localDayIndex } from "@/lib/time";

/**
 * Economía de los planes de hashrate y sats minados. Puro e isomórfico: el servidor calcula el saldo con
 * esto y el navegador mueve los contadores con las mismas funciones.
 *
 * La minería es lineal y no se detiene: sats = TH/s × hashprice (sats por TH/s al día) × días.
 */

export const DAYS_PER_MONTH = 30;
/** Cada pago mensual activa un periodo de 30 días. */
export const PERIOD_MS = DAYS_PER_MONTH * DAY_MS;
/** Días que un plan puede quedar en pausa por falta de pago antes de cerrarse. */
export const GRACE_DAYS = 15;
export const GRACE_MS = GRACE_DAYS * DAY_MS;
export const SATS_PER_BTC = 100_000_000;

export interface PlanEconomics {
  months: number;
  hashrateTh: number;
  /** Lo que se paga cada mes y en todo el contrato (COP) */
  monthlyCop: number;
  totalCop: number;
  /** Sats estimados con el hashprice dado */
  dailySats: number;
  monthlySats: number;
  totalSats: number;
}

export function planEconomics(
  plan: { hashrateTh: number; priceCopPerThMonth: number },
  satsPerThDay: number,
  months = PLAN_MONTHS,
): PlanEconomics {
  const dailySats = plan.hashrateTh * satsPerThDay;
  const monthlyCop = Math.round(plan.hashrateTh * plan.priceCopPerThMonth);
  return {
    months,
    hashrateTh: plan.hashrateTh,
    monthlyCop,
    totalCop: monthlyCop * months,
    dailySats,
    monthlySats: dailySats * DAYS_PER_MONTH,
    totalSats: dailySats * DAYS_PER_MONTH * months,
  };
}

/** Lo que valdría un mes de minería al precio del BTC que se le pase (COP por BTC). Siempre es una estimación. */
export function estimateReturn(econ: PlanEconomics, btcCop: number) {
  const monthlyValueCop = Math.round((econ.monthlySats * btcCop) / SATS_PER_BTC);
  const monthlyProfitCop = monthlyValueCop - econ.monthlyCop;
  return {
    monthlyValueCop,
    monthlyProfitCop,
    /** Utilidad sobre la mensualidad (fracción) */
    profitPct: econ.monthlyCop > 0 ? monthlyProfitCop / econ.monthlyCop : 0,
    /** Precio del BTC (COP) desde el que el mes se paga solo */
    breakEvenBtcCop: econ.monthlySats > 0 ? Math.round((econ.monthlyCop * SATS_PER_BTC) / econ.monthlySats) : 0,
  };
}

/** Un mes pagado: 30 días de minería al hashprice que se fijó al activarlo. */
export interface Period {
  index: number;
  startsAt: number;
  endsAt: number;
  /** Sats por TH/s al día de este mes */
  satsPerThDay: number;
}

/** Sats que mina `hashrateTh` entre dos instantes al hashprice dado. */
export function satsBetween(hashrateTh: number, satsPerThDay: number, from: number, to: number) {
  if (to <= from) return 0;
  return (hashrateTh * satsPerThDay * (to - from)) / DAY_MS;
}

/** Sats minados hasta `now`: solo cuenta el tiempo dentro de los periodos pagados. */
export function minedSats(hashrateTh: number, periods: readonly Period[], now: number) {
  let sats = 0;
  for (const p of periods) sats += satsBetween(hashrateTh, p.satsPerThDay, p.startsAt, Math.min(now, p.endsAt));
  return sats;
}

/** Sats minados hoy (desde la medianoche de Colombia). */
export function todaySats(hashrateTh: number, periods: readonly Period[], now: number) {
  const midnight = dayStartMs(localDayIndex(now));
  let sats = 0;
  for (const p of periods)
    sats += satsBetween(hashrateTh, p.satsPerThDay, Math.max(midnight, p.startsAt), Math.min(now, p.endsAt));
  return sats;
}

export function activePeriod<P extends Pick<Period, "startsAt" | "endsAt">>(periods: readonly P[], now: number) {
  return periods.find((p) => p.startsAt <= now && now < p.endsAt) ?? null;
}

/** Ritmo de minería en este instante (sats por segundo). Cero si no corre un mes pagado. */
export function satsPerSecond(hashrateTh: number, periods: readonly Period[], now: number) {
  const p = activePeriod(periods, now);
  return p ? (hashrateTh * p.satsPerThDay) / 86_400 : 0;
}

export type SubscriptionState =
  | "borrador"
  | "activa"
  | "en_pausa"
  | "completada"
  | "vencida"
  | "cancelada"
  | "en_revision";

/**
 * Estado de un plan, derivado de sus periodos:
 * - borrador: todavía no se confirma el primer pago;
 * - activa: corre un periodo pagado;
 * - en_pausa: terminó el periodo y falta pagar el mes siguiente (hasta 15 días);
 * - vencida: pasaron los 15 días sin pagar: el plan se cerró;
 * - completada: se pagaron y terminaron todos los meses.
 */
export function subscriptionState(
  sub: { months: number; cancelledAt?: number | null },
  periods: readonly Pick<Period, "startsAt" | "endsAt">[],
  now: number,
): SubscriptionState {
  if (sub.cancelledAt != null) return "cancelada";
  if (!periods.length) return "borrador";
  if (activePeriod(periods, now)) return "activa";
  const lastEnd = Math.max(...periods.map((p) => p.endsAt));
  // Puede haber un intervalo sin minería entre un período devuelto y otro ya pagado.
  if (now < lastEnd) return "en_pausa";
  if (periods.length >= sub.months) return "completada";
  return now <= lastEnd + GRACE_MS ? "en_pausa" : "vencida";
}

/** ¿El plan ocupa capacidad de la granja? (activo o en pausa esperando el pago) */
export function reservesCapacity(state: SubscriptionState) {
  return state === "activa" || state === "en_pausa" || state === "en_revision";
}

/** Ventana del periodo que activaría un pago confirmado en `now`. */
export function nextPeriodWindow(periods: readonly Pick<Period, "endsAt">[], now: number) {
  const lastEnd = periods.length ? Math.max(...periods.map((p) => p.endsAt)) : now;
  const startsAt = Math.max(now, lastEnd);
  return { index: periods.length + 1, startsAt, endsAt: startsAt + PERIOD_MS };
}
