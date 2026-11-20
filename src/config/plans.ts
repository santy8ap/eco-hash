/**
 * Planes de hashrate. Cada plan es un contrato de 3 meses que se paga mes a mes, en pesos.
 * Los precios son los valores iniciales: el admin puede cambiarlos y cada plan comprado guarda el suyo.
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
  { id: "h100", name: "Nonce", hashrateTh: 100, priceCopPerThMonth: 4600 },
  { id: "h250", name: "Bloque", hashrateTh: 250, priceCopPerThMonth: 4450 },
  { id: "h500", name: "Cadena", hashrateTh: 500, priceCopPerThMonth: 4300 },
  { id: "h1000", name: "Génesis", hashrateTh: 1000, priceCopPerThMonth: 4200 },
];

export type PlanId = (typeof PLANS)[number]["id"];
