import { describe, expect, it } from "vitest";
import { accountNotices } from "@/lib/notifications";
import type { PortfolioDTO, SubscriptionDTO } from "@/lib/portfolio";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 12, 15);

function sub(over: Partial<SubscriptionDTO>): SubscriptionDTO {
  return {
    id: "PLN-00000001",
    planId: "h100",
    planName: "Nonce",
    hashrateTh: 100,
    months: 3,
    monthlyCop: 260_000,
    priceCopPerThMonth: 2600,
    state: "activa",
    paidMonths: 3,
    periods: [],
    startedAt: NOW - 85 * DAY,
    paidUntil: NOW + 5 * DAY,
    graceEndsAt: null,
    minedSats: 0,
    ...over,
  };
}

const portfolio = (subscriptions: SubscriptionDTO[]) => ({ asOf: NOW, subscriptions, transactions: [] }) as unknown as PortfolioDTO;
const renewals = (subscriptions: SubscriptionDTO[]) => accountNotices(portfolio(subscriptions), NOW).filter((n) => n.action === "Renovar");

describe("avisos para renovar un plan", () => {
  it("con todos los meses pagados y a una semana de terminar, invita a renovar el mismo plan", () => {
    const [n] = renewals([sub({})]);
    expect(n).toMatchObject({ title: "Tu Nonce termina pronto", href: "/comprar?plan=h100" });
  });

  it("todavía lejos del final, o con meses por pagar, no hay aviso de renovación", () => {
    expect(renewals([sub({ paidUntil: NOW + 20 * DAY })])).toEqual([]);
    expect(renewals([sub({ paidMonths: 2 })])).toEqual([]);
  });

  it("un plan que terminó hace poco invita a renovarlo; uno de hace meses, no", () => {
    expect(renewals([sub({ state: "completada", paidUntil: NOW - 3 * DAY })])[0]).toMatchObject({ title: "Tu Nonce terminó", href: "/comprar?plan=h100" });
    expect(renewals([sub({ state: "completada", paidUntil: NOW - 60 * DAY })])).toEqual([]);
  });

  it("si ya compró otro plan igual después, no insiste", () => {
    const old = sub({ state: "completada", paidUntil: NOW - 3 * DAY });
    const renewed = sub({ id: "PLN-00000002", state: "activa", paidMonths: 1, startedAt: NOW - 2 * DAY, paidUntil: NOW + 28 * DAY });
    expect(renewals([old, renewed])).toEqual([]);
  });
});
