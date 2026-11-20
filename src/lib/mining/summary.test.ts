import { describe, expect, it } from "vitest";
import { PERIOD_MS, type Period } from "@/lib/mining/plan-math";
import { dailyReturns, summarize } from "@/lib/mining/summary";
import { DAY_MS, bogotaMs } from "@/lib/time";

const at = (d: number, h = 0, m = 0) => bogotaMs(2026, 11, d, h, m);
const period = (index: number, startsAt: number, satsPerThDay = 42): Period => ({
  index,
  startsAt,
  endsAt: startsAt + PERIOD_MS,
  satsPerThDay,
});

describe("resumen de los planes de un usuario", () => {
  it("suma lo minado, lo de hoy, el costo proporcional y el hashrate activo", () => {
    const p1 = period(1, at(1, 0));
    const plans = [
      { hashrateTh: 100, priceCopPerThMonth: 4600, periods: [p1] },
      { hashrateTh: 250, priceCopPerThMonth: 4450, periods: [period(1, at(1, 0) + 40 * DAY_MS)] },
    ];
    const s = summarize(plans, at(11, 0));
    expect(s.minedSats).toBe(42_000);
    expect(s.todaySats).toBe(0);
    expect(s.costCop).toBeCloseTo((100 * 4600 * 10) / 30, 6);
    expect(s.activeTh).toBe(100);
    expect(s.dailySats).toBe(4_200);
    expect(s.dailyCostCop).toBeCloseTo((100 * 4600) / 30, 6);
  });

  it("sin planes todo es cero", () => {
    expect(summarize([], at(3))).toEqual({ minedSats: 0, todaySats: 0, costCop: 0, activeTh: 0, dailySats: 0, dailyCostCop: 0 });
  });
});

describe("rendimiento día a día", () => {
  const plans = [{ hashrateTh: 100, priceCopPerThMonth: 4600, periods: [period(1, at(1, 8))] }];

  it("hoy primero, con los días completos y el primero desde la hora del pago", () => {
    const rows = dailyReturns(plans, at(3, 12));
    expect(rows.map((r) => [r.dayStart, r.sats, r.today])).toEqual([
      [at(3), 2_100, true],
      [at(2), 4_200, false],
      [at(1), 2_800, false],
    ]);
    expect(rows[1].costCop).toBeCloseTo((100 * 4600) / 30, 6);
  });

  it("no pasa del límite de días pedido", () => {
    expect(dailyReturns(plans, at(20, 12), 7)).toHaveLength(7);
  });

  it("sin pagos no hay filas", () => {
    expect(dailyReturns([{ hashrateTh: 100, priceCopPerThMonth: 4600, periods: [] }], at(3))).toEqual([]);
  });
});
