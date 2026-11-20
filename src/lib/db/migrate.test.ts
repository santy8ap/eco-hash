import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { alreadyApplied, migrate } from "@/lib/db/migrate";
import { MIGRATIONS } from "@/lib/db/migrations.generated";

let client: Client;
const count = async (table: string) => Number((await client.execute(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);
const tables = async () => (await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'")).rows.map((r) => String(r.name));
const columns = async (table: string) => (await client.execute(`PRAGMA table_info(${table})`)).rows.map((r) => String(r.name));

/** Una base nueva, como la que crea la app al arrancar por primera vez. */
beforeAll(async () => {
  client = createClient({ url: `file:${path.join(mkdtempSync(path.join(tmpdir(), "ech-migrate-")), "new.db")}` });
  await migrate(client);
});

describe("migraciones de eco-hash", () => {
  it("crea las tablas del dominio de minería y no deja nada del modelo de energía", async () => {
    const t = await tables();
    for (const made of ["farm", "plan_subscription", "plan_period", "ledger_tx", "company_profile", "rate_limit", "__ecohash_migrations"]) expect(t).toContain(made);
    for (const gone of ["plant", "position_entry", "listing", "telemetry", "legacy_ledger_tx", "__solaxy_migrations"]) expect(t).not.toContain(gone);
  });

  it("la granja, los planes y los movimientos guardan TH/s, hashprice y sats", async () => {
    expect(await columns("farm")).toEqual(["id", "name", "location", "capacity_th", "sats_per_th_day", "plan_prices", "updated_at"]);
    expect(await columns("plan_subscription")).toEqual(expect.arrayContaining(["hashrate_th", "price_cop_per_th_month"]));
    expect(await columns("plan_period")).toEqual(expect.arrayContaining(["hashrate_th", "sats_per_th_day", "amount_cop", "tx_id"]));
    const ledger = await columns("ledger_tx");
    expect(ledger).toEqual(expect.arrayContaining(["hashrate_th", "amount_sats", "wallet_address", "tx_hash"]));
    for (const gone of ["kwh", "kw", "bank_name", "bank_account_number"]) expect(ledger).not.toContain(gone);
  });

  it("es seguro correrla otra vez: anota cada migración una sola vez", async () => {
    await migrate(client);
    expect((await client.execute("SELECT id FROM __ecohash_migrations ORDER BY id")).rows.map((r) => r.id)).toEqual(MIGRATIONS.map((m) => m.id));
    expect(await count("farm")).toBe(0);
  });

  it("solo tolera que falte algo cuando la sentencia quita o renombra", () => {
    expect(alreadyApplied("ALTER TABLE `x` ADD `y` text;", "duplicate column name: y")).toBe(true);
    expect(alreadyApplied("ALTER TABLE `ledger_tx` DROP COLUMN `kw`;", "no such column: kw")).toBe(true);
    expect(alreadyApplied("DROP TABLE `listing`;", "no such table: listing")).toBe(true);
    expect(alreadyApplied("DELETE FROM `ledger_tx` WHERE coalesce(`kw`, 0) = 0;", "no such column: kw")).toBe(true);
    expect(alreadyApplied("INSERT OR IGNORE INTO `a` SELECT * FROM `b`;", "no such table: b")).toBe(true);
    expect(alreadyApplied("INSERT INTO `a` SELECT * FROM `b`;", "no such table: b")).toBe(false);
    // Archivar una tabla que la misma migración retira después: al repetirse, la tabla ya no está.
    expect(alreadyApplied("CREATE TABLE IF NOT EXISTS `legacy_x` AS SELECT * FROM `x`;", "no such table: x")).toBe(true);
    expect(alreadyApplied("CREATE TABLE `y` AS SELECT * FROM `x`;", "no such table: x")).toBe(false);
    expect(alreadyApplied("CREATE INDEX `i` ON `t` (`nope`);", "no such column: nope")).toBe(false);
  });
});

describe("vistas previas de Vercel: comparten la base de datos con producción", () => {
  const fresh = () => createClient({ url: `file:${path.join(mkdtempSync(path.join(tmpdir(), "ech-migrate-")), "preview.db")}` });
  const hasTable = async (c: Client, name: string) => (await c.execute({ sql: "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", args: [name] })).rows.length > 0;
  afterEach(() => vi.unstubAllEnvs());

  it("una vista previa con migraciones pendientes no toca la base", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const c = fresh();
    await expect(migrate(c, { localFile: false })).rejects.toThrow(/vista previa/i);
    expect(await hasTable(c, "user")).toBe(false);
    expect(await hasTable(c, "plan_subscription")).toBe(false);
  });

  it("con una base propia para las vistas previas (ALLOW_PREVIEW_MIGRATIONS=true) sí migra", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("ALLOW_PREVIEW_MIGRATIONS", "true");
    const c = fresh();
    await migrate(c, { localFile: false });
    expect(await hasTable(c, "plan_subscription")).toBe(true);
  });

  it("con su propia base (PREVIEW_TURSO_DATABASE_URL) la vista previa migra sola", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PREVIEW_TURSO_DATABASE_URL", "libsql://eco-hash-preview.turso.io");
    const c = fresh();
    await migrate(c, { localFile: false });
    expect(await hasTable(c, "plan_subscription")).toBe(true);
  });

  it("si no hay nada pendiente, la vista previa funciona normal", async () => {
    const c = fresh();
    await migrate(c, { localFile: false });
    vi.stubEnv("VERCEL_ENV", "preview");
    await expect(migrate(c, { localFile: false })).resolves.toBeUndefined();
  });

  it("producción migra, y un archivo local (que no se comparte) también", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const prod = fresh();
    await migrate(prod, { localFile: false });
    expect(await hasTable(prod, "plan_subscription")).toBe(true);

    vi.stubEnv("VERCEL_ENV", "preview");
    const local = fresh();
    await migrate(local, { localFile: true });
    expect(await hasTable(local, "plan_subscription")).toBe(true);
  });
});
