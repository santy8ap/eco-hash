"use client";
import { DEFAULT_SETTINGS, catalogFrom, type CatalogPlan } from "@/lib/farm-settings";
import { useJson } from "./use-json";
import { useNow } from "./use-now";

/** Lo que devuelve /api/plans. */
export interface CatalogDTO {
  /** Hora del servidor al responder (falta en los valores iniciales) */
  asOf?: number;
  farmName: string;
  location: string;
  /** Hashprice vigente (sats por TH/s al día) */
  satsPerThDay: number;
  capacityTh: number;
  contractedTh: number;
  availableTh: number;
  plans: (CatalogPlan & { available: boolean })[];
}

/** Lo que se muestra mientras llega el catálogo del servidor: los valores iniciales, que casi siempre son los vigentes. */
export const DEFAULT_CATALOG: CatalogDTO = {
  farmName: DEFAULT_SETTINGS.name,
  location: DEFAULT_SETTINGS.location,
  satsPerThDay: DEFAULT_SETTINGS.satsPerThDay,
  capacityTh: DEFAULT_SETTINGS.capacityTh,
  contractedTh: 0,
  availableTh: DEFAULT_SETTINGS.capacityTh,
  plans: catalogFrom(DEFAULT_SETTINGS).map((p) => ({ ...p, available: true })),
};

/** Catálogo vigente (precios y hashprice que puede cambiar el admin, y capacidad libre de la granja). */
export function useCatalog() {
  const { data, error, receivedAt, reload } = useJson<CatalogDTO>("/api/plans", { refreshMs: 5 * 60_000 });
  // Diferencia entre el reloj del servidor y el de este dispositivo.
  const clockOffset = data?.asOf && receivedAt ? data.asOf - receivedAt : 0;
  return {
    catalog: data ?? DEFAULT_CATALOG,
    loaded: !!data,
    error,
    reload,
    clockOffset,
  };
}

/**
 * La hora de la granja: la del servidor, no la del dispositivo. Así los contadores marcan lo mismo para todos,
 * aunque el computador o el celular tengan la hora mal puesta.
 */
export function useFarmNow(everyMs = 1000) {
  const { clockOffset } = useCatalog();
  return useNow(everyMs, clockOffset);
}
