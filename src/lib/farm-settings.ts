import { DEFAULT_HASHPRICE_SATS, FARM } from "@/config/farm";
import { PLANS, PLAN_MONTHS, type PlanSpec } from "@/config/plans";
import { planEconomics, type PlanEconomics } from "@/lib/mining/plan-math";

/** Lo que el administrador puede cambiar de la granja y de los planes. Isomórfico. */
export interface FarmSettings {
  name: string;
  location: string;
  /** Hashrate total que se puede vender (TH/s) */
  capacityTh: number;
  /** Hashprice vigente: sats que mina 1 TH/s en un día */
  satsPerThDay: number;
  /** Precio por TH/s al mes (COP) de cada plan, por id */
  planPrices: Record<string, number>;
  updatedAt: number | null;
}

export const DEFAULT_SETTINGS: FarmSettings = {
  name: FARM.name,
  location: FARM.location,
  capacityTh: FARM.capacityTh,
  satsPerThDay: DEFAULT_HASHPRICE_SATS,
  planPrices: Object.fromEntries(PLANS.map((p) => [p.id, p.priceCopPerThMonth])),
  updatedAt: null,
};

/** Lee el JSON de precios guardado; lo que falte o esté mal usa el valor inicial del plan. */
export function parsePlanPrices(raw: string | null | undefined): Record<string, number> {
  let saved: Record<string, unknown> = {};
  try {
    const json = JSON.parse(raw || "{}");
    if (json && typeof json === "object") saved = json as Record<string, unknown>;
  } catch {
    /* JSON dañado: se usan los valores iniciales */
  }
  return Object.fromEntries(
    PLANS.map((p) => {
      const v = Number(saved[p.id]);
      return [p.id, Number.isFinite(v) && v > 0 ? Math.round(v) : p.priceCopPerThMonth];
    }),
  );
}

/** Un plan del catálogo con su precio vigente y su economía al hashprice de hoy. */
export interface CatalogPlan extends PlanSpec, PlanEconomics {
  satsPerThDay: number;
}

export function catalogFrom(s: Pick<FarmSettings, "satsPerThDay" | "planPrices">): CatalogPlan[] {
  return PLANS.map((p) => {
    const plan = { ...p, priceCopPerThMonth: s.planPrices[p.id] ?? p.priceCopPerThMonth };
    return { ...plan, satsPerThDay: s.satsPerThDay, ...planEconomics(plan, s.satsPerThDay, PLAN_MONTHS) };
  });
}

const thLabel = (th: number) => `${Math.round(th).toLocaleString("es-CO")} TH/s`;

/** Devuelve el primer problema encontrado, o null si todo está bien. */
export function validateSettings(s: FarmSettings, ctx: { contractedTh: number }): string | null {
  if (!s.name || s.name.trim().length < 2 || s.name.length > 60) return "El nombre de la granja debe tener entre 2 y 60 caracteres.";
  if (!s.location || s.location.trim().length < 2 || s.location.length > 80) return "La ubicación debe tener entre 2 y 80 caracteres.";
  if (!Number.isFinite(s.capacityTh) || s.capacityTh < 100 || s.capacityTh > 10_000_000) return "La capacidad debe estar entre 100 y 10.000.000 TH/s.";
  if (s.capacityTh + 1e-6 < ctx.contractedTh) {
    return `Con esa capacidad la granja tendría ${thLabel(s.capacityTh)}, menos que los ${thLabel(ctx.contractedTh)} ya contratados.`;
  }
  if (!Number.isFinite(s.satsPerThDay) || s.satsPerThDay < 1 || s.satsPerThDay > 1000 || Math.round(s.satsPerThDay * 10) !== s.satsPerThDay * 10)
    return "El hashprice debe estar entre 1 y 1.000 sats por TH/s al día, con máximo un decimal.";
  for (const p of PLANS) {
    const price = s.planPrices[p.id];
    if (!Number.isInteger(price) || price < 100 || price > 1_000_000) return `El precio por TH/s del plan ${p.name} debe ser un número entero entre $ 100 y $ 1.000.000.`;
  }
  return null;
}
