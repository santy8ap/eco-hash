import "server-only";
import { eq } from "drizzle-orm";
import { FARM } from "@/config/farm";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { farm } from "@/lib/db/schema";
import { DEFAULT_SETTINGS, catalogFrom, parsePlanPrices, type FarmSettings } from "@/lib/farm-settings";

let cache: { at: number; value: FarmSettings } | null = null;

export function invalidateSettings() {
  cache = null;
}

/** Configuración vigente de la granja y de los planes (caché de 5 s). */
export async function readSettings(): Promise<FarmSettings> {
  if (cache && Date.now() - cache.at < 5000) return cache.value;
  await ensureReady();
  const [row] = await db.select().from(farm).where(eq(farm.id, FARM.id));
  const value: FarmSettings = row
    ? {
        name: row.name,
        location: row.location,
        capacityTh: row.capacityTh,
        satsPerThDay: row.satsPerThDay,
        planPrices: parsePlanPrices(row.planPrices),
        updatedAt: row.updatedAt ?? null,
      }
    : DEFAULT_SETTINGS;
  cache = { at: Date.now(), value };
  return value;
}

/** Configuración con lo que se deriva de ella: el catálogo y la capacidad de la granja. */
export async function readConfig() {
  const settings = await readSettings();
  return { settings, catalog: catalogFrom(settings), capacityTh: settings.capacityTh };
}

export type Config = Awaited<ReturnType<typeof readConfig>>;
