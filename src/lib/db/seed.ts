import "server-only";
import { eq } from "drizzle-orm";
import { FARM } from "@/config/farm";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { DEFAULT_SETTINGS } from "@/lib/farm-settings";
import type { Db } from "./client";
import { farm, user } from "./schema";

/** Crea la fila de la granja con los valores iniciales si no existe. No se inventan clientes ni movimientos. */
export async function seedFarm(db: Db) {
  await db
    .insert(farm)
    .values({
      id: FARM.id,
      name: DEFAULT_SETTINGS.name,
      location: DEFAULT_SETTINGS.location,
      capacityTh: DEFAULT_SETTINGS.capacityTh,
      satsPerThDay: DEFAULT_SETTINGS.satsPerThDay,
      planPrices: JSON.stringify(DEFAULT_SETTINGS.planPrices),
    })
    .onConflictDoNothing();
}

/**
 * Cuenta de pruebas (solo en modo de pruebas): se crea la primera vez que alguien entra con ella.
 * El registro con correo y contraseña está cerrado al público, así que la crea el servidor directamente.
 */
export async function ensureDemoAccount(db: Db) {
  const find = async () => (await db.select({ id: user.id }).from(user).where(eq(user.email, env.demoEmail)))[0]?.id;
  const existing = await find();
  if (existing) return existing;
  const ctx = await auth.$context;
  try {
    const created = await ctx.internalAdapter.createUser({ email: env.demoEmail, name: env.demoName, emailVerified: true }, { method: "email-password" });
    await ctx.internalAdapter.linkAccount({ userId: created.id, providerId: "credential", accountId: created.id, password: await ctx.password.hash(env.demoPassword) });
    return created.id;
  } catch (err) {
    // Otra solicitud la creó al mismo tiempo.
    const again = await find();
    if (again) return again;
    throw err;
  }
}
