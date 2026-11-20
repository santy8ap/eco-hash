import { describe, expect, it } from "vitest";
import { MIN_WITHDRAWAL_SATS, parseWithdrawalSats } from "./withdrawal-schema";

describe("monto de un retiro en sats", () => {
  it("el mínimo es de 50.000 sats", () => {
    expect(MIN_WITHDRAWAL_SATS).toBe(50_000);
  });

  it("acepta números y textos con separadores de miles, sin decimales", () => {
    expect(parseWithdrawalSats(75_000)).toBe(75_000);
    expect(parseWithdrawalSats(75_000.9)).toBe(75_000);
    expect(parseWithdrawalSats("120.500")).toBe(120_500);
    expect(parseWithdrawalSats(" 1 250 000 ")).toBe(1_250_000);
  });

  it("rechaza lo que no es un monto positivo", () => {
    for (const raw of [0, -5, Number.NaN, Infinity, "", "diez", null, undefined, {}]) expect(parseWithdrawalSats(raw)).toBeNull();
  });
});
