import { describe, expect, it } from "vitest";
import { formatBtc, formatHashprice, formatHashrate, formatSats, formatTh } from "./format";

describe("formatos de minería", () => {
  it("sats enteros, redondeados hacia abajo, con singular", () => {
    expect(formatSats(126_000.7)).toBe("126.000 sats");
    expect(formatSats(1)).toBe("1 sat");
    expect(formatSats(0)).toBe("0 sats");
  });

  it("BTC con 8 decimales a partir de sats", () => {
    expect(formatBtc(126_000)).toBe("0,00126000 BTC");
    expect(formatBtc(150_000_000)).toBe("1,50000000 BTC");
    expect(formatBtc(126_000.9)).toBe("0,00126000 BTC");
  });

  it("TH/s de un plan y hashrate con la unidad que le queda mejor", () => {
    expect(formatTh(1000)).toBe("1.000 TH/s");
    expect(formatTh(250)).toBe("250 TH/s");
    expect(formatHashrate(250)).toBe("250 TH/s");
    expect(formatHashrate(30_000)).toBe("30 PH/s");
    expect(formatHashrate(12_500)).toBe("12,5 PH/s");
    expect(formatHashrate(850_000_000)).toBe("850 EH/s");
    expect(formatHashrate(1_200_000_000)).toBe("1,2 ZH/s");
  });

  it("hashprice en sats por TH/s al día", () => {
    expect(formatHashprice(42)).toBe("42 sats/TH/día");
    expect(formatHashprice(41.5)).toBe("41,5 sats/TH/día");
  });
});
