/** Retiros en BTC: reglas compartidas por el formulario y el servidor. Isomórfico. */

/** Retiro mínimo (sats): 0,0005 BTC. */
export const MIN_WITHDRAWAL_SATS = 50_000;

/** El monto en sats de un formulario o de una petición: entero positivo, o null. Acepta separadores de miles. */
export function parseWithdrawalSats(raw: unknown): number | null {
  let n: number;
  if (typeof raw === "number") n = raw;
  else if (typeof raw === "string" && /^[\d\s.,_]+$/.test(raw.trim()) && /\d/.test(raw)) n = Number(raw.replace(/[\s.,_]/g, ""));
  else return null;
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}
