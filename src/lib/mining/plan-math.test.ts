import { describe, expect, it } from "vitest";
import { PLANS, PLAN_MONTHS } from "@/config/plans";
import { DEFAULT_HASHPRICE_SATS, FARM } from "@/config/farm";
import {
  GRACE_MS,
  PERIOD_MS,
  SATS_PER_BTC,
  estimateReturn,
  minedSats,
  nextPeriodWindow,
  planEconomics,
  satsBetween,
  satsPerSecond,
  subscriptionState,
  todaySats,
  type Period,
} from "@/lib/mining/plan-math";
import { DAY_MS, HOUR_MS, bogotaMs } from "@/lib/time";

const at = (d: number, h = 0, m = 0) => bogotaMs(2026, 11, d, h, m);
const period = (index: number, startsAt: number, satsPerThDay = 42): Period => ({
  index,
  startsAt,
  endsAt: startsAt + PERIOD_MS,
  satsPerThDay,
});

describe("catálogo de hashrate", () => {
  it("son cuatro planes de 3 meses: 100, 250, 500 y 1.000 TH/s", () => {
    expect(PLAN_MONTHS).toBe(3);
    expect(PLANS.map((p) => [p.id, p.name, p.hashrateTh, p.priceCopPerThMonth])).toEqual([
      ["h100", "Nonce", 100, 4600],
      ["h250", "Bloque", 250, 4450],
      ["h500", "Cadena", 500, 4300],
      ["h1000", "Génesis", 1000, 4200],
    ]);
  });

  it("la granja empieza con 30 PH/s y un hashprice de 42 sats por TH/s al día", () => {
    expect(FARM.capacityTh).toBe(30_000);
    expect(DEFAULT_HASHPRICE_SATS).toBe(42);
    expect(SATS_PER_BTC).toBe(100_000_000);
  });
});

describe("economía de un plan", () => {
  it("mensualidad en pesos y sats estimados por día, mes y contrato", () => {
    const rows = PLANS.map((plan) => planEconomics(plan, 42));
    expect(rows.map((r) => r.monthlyCop)).toEqual([460_000, 1_112_500, 2_150_000, 4_200_000]);
    expect(rows.map((r) => r.totalCop)).toEqual([1_380_000, 3_337_500, 6_450_000, 12_600_000]);
    expect(rows.map((r) => r.dailySats)).toEqual([4_200, 10_500, 21_000, 42_000]);
    expect(rows.map((r) => r.monthlySats)).toEqual([126_000, 315_000, 630_000, 1_260_000]);
    expect(rows[0]).toMatchObject({ months: 3, hashrateTh: 100, totalSats: 378_000 });
  });

  it("la rentabilidad se estima al precio del BTC que se le pase", () => {
    const est = estimateReturn(planEconomics(PLANS[0], 42), 420_000_000);
    expect(est.monthlyValueCop).toBe(529_200);
    expect(est.monthlyProfitCop).toBe(69_200);
    expect(est.profitPct).toBeCloseTo(0.150434, 5);
    expect(est.breakEvenBtcCop).toBe(365_079_365);
  });

  it("con el BTC barato la estimación muestra pérdida, sin inventar ganancias", () => {
    const est = estimateReturn(planEconomics(PLANS[0], 42), 300_000_000);
    expect(est.monthlyValueCop).toBe(378_000);
    expect(est.monthlyProfitCop).toBe(-82_000);
    expect(est.profitPct).toBeLessThan(0);
  });
});

describe("sats minados", () => {
  it("la minería es lineal y 24/7: 12 horas son medio día, de noche también", () => {
    expect(satsBetween(100, 42, at(2, 20), at(3, 8))).toBe(2_100);
    expect(satsBetween(100, 42, at(3, 8), at(2, 20))).toBe(0);
  });

  it("un periodo completo mina exactamente TH/s × hashprice × 30 y nunca más", () => {
    const p1 = period(1, at(1, 8));
    expect(minedSats(100, [p1], p1.endsAt)).toBe(126_000);
    expect(minedSats(100, [p1], p1.endsAt + 10 * DAY_MS)).toBe(126_000);
  });

  it("cada mes mina con el hashprice que guardó al activarse", () => {
    const p1 = period(1, at(1, 8), 42);
    const p2 = period(2, p1.endsAt, 40);
    expect(minedSats(100, [p1, p2], p2.startsAt + 15 * DAY_MS)).toBe(126_000 + 60_000);
  });

  it("en una pausa entre meses no se mina", () => {
    const p1 = period(1, at(1, 8));
    const p2 = period(2, p1.endsAt + 5 * DAY_MS);
    expect(minedSats(100, [p1, p2], p1.endsAt + 3 * DAY_MS)).toBe(126_000);
  });

  it("lo de hoy cuenta desde la medianoche de Colombia y solo dentro de un mes pagado", () => {
    const p1 = period(1, at(1, 8));
    expect(todaySats(100, [p1], at(1, 18))).toBe(1_750);
    expect(todaySats(100, [p1], at(2, 6))).toBe(1_050);
    // El día en que termina el mes solo cuenta hasta el final del periodo (8 h), y el siguiente, nada.
    expect(todaySats(100, [p1], p1.endsAt + 2 * HOUR_MS)).toBe(1_400);
    expect(todaySats(100, [p1], p1.endsAt + DAY_MS)).toBe(0);
  });

  it("el ritmo por segundo es el diario repartido en 86.400 s, y cero sin un mes activo", () => {
    const p1 = period(1, at(1, 8));
    expect(satsPerSecond(100, [p1], at(1, 9))).toBeCloseTo(4_200 / 86_400, 10);
    expect(satsPerSecond(100, [p1], at(1, 7))).toBe(0);
  });
});

describe("estado de un plan según sus periodos", () => {
  const sub = { months: 3, cancelledAt: null };
  const p1 = period(1, at(1, 8));

  it("sin periodos es un borrador", () => {
    expect(subscriptionState(sub, [], at(1))).toBe("borrador");
  });

  it("activa mientras corre un periodo pagado", () => {
    expect(subscriptionState(sub, [p1], p1.startsAt)).toBe("activa");
    expect(subscriptionState(sub, [p1], p1.endsAt - 1)).toBe("activa");
  });

  it("en pausa al terminar el periodo si faltan meses por pagar; vencida tras 15 días", () => {
    expect(subscriptionState(sub, [p1], p1.endsAt)).toBe("en_pausa");
    expect(subscriptionState(sub, [p1], p1.endsAt + GRACE_MS)).toBe("en_pausa");
    expect(subscriptionState(sub, [p1], p1.endsAt + GRACE_MS + 1)).toBe("vencida");
  });

  it("completada cuando terminan los 3 meses pagados", () => {
    const p2 = period(2, p1.endsAt);
    const p3 = period(3, p2.endsAt);
    expect(subscriptionState(sub, [p1, p2, p3], p3.endsAt - 1)).toBe("activa");
    expect(subscriptionState(sub, [p1, p2, p3], p3.endsAt)).toBe("completada");
  });

  it("cancelada si el admin la cerró", () => {
    expect(subscriptionState({ months: 3, cancelledAt: at(5) }, [p1], at(6))).toBe("cancelada");
  });

  it("una devolución deja el hueco sin minar antes de otro mes ya pagado", () => {
    const cut = at(5, 12);
    const p2 = period(2, p1.endsAt);
    const periods = [{ ...p1, endsAt: cut }, p2];
    expect(subscriptionState(sub, periods, at(10, 12))).toBe("en_pausa");
    expect(satsPerSecond(100, periods, at(10, 12))).toBe(0);
    expect(subscriptionState(sub, periods, p2.startsAt)).toBe("activa");
    expect(nextPeriodWindow(periods, at(10)).startsAt).toBe(p2.endsAt);
  });
});

describe("cuándo empieza el siguiente periodo", () => {
  it("el primero empieza al confirmarse el pago", () => {
    expect(nextPeriodWindow([], at(3, 9))).toEqual({ index: 1, startsAt: at(3, 9), endsAt: at(3, 9) + PERIOD_MS });
  });

  it("si se paga antes, empieza al terminar el anterior; si se paga tarde, al confirmarse", () => {
    const p1 = period(1, at(1, 8));
    expect(nextPeriodWindow([p1], at(20)).startsAt).toBe(p1.endsAt);
    const late = p1.endsAt + 4 * DAY_MS;
    expect(nextPeriodWindow([p1], late)).toEqual({ index: 2, startsAt: late, endsAt: late + PERIOD_MS });
  });
});
