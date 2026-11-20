import { DAY_MS, dayStartMs, localDayIndex } from "@/lib/time";
import { DAYS_PER_MONTH, activePeriod, minedSats, satsBetween, todaySats, type Period } from "./plan-math";

/** Lo mínimo de un plan para calcular sus sats y su costo. */
export interface PlanForSummary {
  hashrateTh: number;
  priceCopPerThMonth: number;
  periods: readonly Period[];
}

/** Costo por milisegundo de minería de un plan (COP): la mensualidad repartida en 30 días. */
const costPerMs = (p: PlanForSummary) => (p.hashrateTh * p.priceCopPerThMonth) / (DAYS_PER_MONTH * DAY_MS);

/** Tiempo de minería (ms) de los periodos de un plan dentro de [from, to). */
function minedMs(periods: readonly Period[], from: number, to: number) {
  let ms = 0;
  for (const p of periods) ms += Math.max(0, Math.min(to, p.endsAt) - Math.max(from, p.startsAt));
  return ms;
}

/**
 * Sats y costo de un conjunto de planes en el instante `now`. Puro e isomórfico: el servidor calcula el
 * saldo con esto y el navegador mueve los contadores entre una consulta y otra.
 */
export function summarize(plans: readonly PlanForSummary[], now: number) {
  let mined = 0;
  let today = 0;
  let cost = 0;
  let activeTh = 0;
  let dailySats = 0;
  let dailyCost = 0;
  for (const p of plans) {
    mined += minedSats(p.hashrateTh, p.periods, now);
    today += todaySats(p.hashrateTh, p.periods, now);
    cost += minedMs(p.periods, -Infinity, now) * costPerMs(p);
    const current = activePeriod(p.periods, now);
    if (current) {
      activeTh += p.hashrateTh;
      dailySats += p.hashrateTh * current.satsPerThDay;
      dailyCost += costPerMs(p) * DAY_MS;
    }
  }
  return { minedSats: mined, todaySats: today, costCop: cost, activeTh, dailySats, dailyCostCop: dailyCost };
}

export type MiningSummary = ReturnType<typeof summarize>;

/** Lo que minaron los planes en un día. */
export interface DayReturn {
  /** Medianoche (hora de Colombia) con la que empieza el día */
  dayStart: number;
  sats: number;
  /** Parte proporcional de las mensualidades de ese día (COP) */
  costCop: number;
  /** El día en curso: sus cifras siguen creciendo */
  today: boolean;
}

/**
 * Minería día a día, con hoy primero: hasta `days` días, sin pasar del día del primer pago.
 * Un día sin mes pagado (plan en pausa) aparece con cero.
 */
export function dailyReturns(plans: readonly PlanForSummary[], now: number, days = 7): DayReturn[] {
  const starts = plans.flatMap((p) => p.periods.map((x) => x.startsAt));
  if (!starts.length) return [];
  const firstDay = localDayIndex(Math.min(...starts));
  const todayIndex = localDayIndex(now);
  const rows: DayReturn[] = [];
  for (let day = todayIndex; day >= firstDay && rows.length < days; day--) {
    const start = dayStartMs(day);
    const end = Math.min(now, start + DAY_MS);
    let sats = 0;
    let cost = 0;
    for (const p of plans) {
      for (const period of p.periods)
        sats += satsBetween(p.hashrateTh, period.satsPerThDay, Math.max(start, period.startsAt), Math.min(end, period.endsAt));
      cost += minedMs(p.periods, start, end) * costPerMs(p);
    }
    rows.push({ dayStart: start, sats, costCop: cost, today: day === todayIndex });
  }
  return rows;
}
