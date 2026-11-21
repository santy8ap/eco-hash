/**
 * Planes de hashrate. Cada plan es un contrato de 3 meses que se paga mes a mes, en pesos.
 * Los precios son los valores iniciales: el admin puede cambiarlos y cada plan comprado guarda el suyo.
 * Están calibrados para noviembre de 2026 (BTC cerca de 200 millones de pesos y 42 sats por TH/s al día):
 * el plan pequeño queda cerca del punto de equilibrio y los grandes, con descuento por volumen.
 */
export interface PlanSpec {
  id: string;
  /** Nombre corto del plan, con sabor a Bitcoin */
  name: string;
  /** Hashrate contratado (TH/s): constante durante todo el contrato */
  hashrateTh: number;
  /** Lo que cuesta cada TH/s durante un mes de 30 días (COP). Incluye energía y mantenimiento. */
  priceCopPerThMonth: number;
}

/** Duración del contrato, en meses de 30 días. */
export const PLAN_MONTHS = 3;

export const PLANS: readonly PlanSpec[] = [
  { id: "h100", name: "Nonce", hashrateTh: 100, priceCopPerThMonth: 2600 },
  { id: "h250", name: "Bloque", hashrateTh: 250, priceCopPerThMonth: 2500 },
  { id: "h500", name: "Cadena", hashrateTh: 500, priceCopPerThMonth: 2400 },
  { id: "h1000", name: "Génesis", hashrateTh: 1000, priceCopPerThMonth: 2300 },
];

export type PlanId = (typeof PLANS)[number]["id"];
