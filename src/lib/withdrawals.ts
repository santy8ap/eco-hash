import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { alertWithdrawalRequested } from "@/lib/alerts";
import { parseBtcAddress } from "@/lib/btc-address";
import { db } from "@/lib/db";
import { ledgerTx, walletLink } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/env";
import { MarketError } from "@/lib/errors";
import { formatSats } from "@/lib/format";
import { orderCode } from "@/lib/ids";
import { noPaymentReviewSql, requireNoPaymentReview } from "@/lib/payments/reversals";
import { getBalance, toTxDTO } from "@/lib/portfolio";
import { requireCompleteProfile } from "@/lib/profile";
import { getRates } from "@/lib/rates";
import { MIN_WITHDRAWAL_SATS } from "@/lib/withdrawal-schema";

/**
 * Retiros de los sats minados a una dirección Bitcoin. Todos quedan esperando al administrador, que envía los
 * BTC desde la billetera de eco-hash y registra el txid. No hace falta firmar: el destino lo elige el titular
 * dentro de su cuenta y el admin verifica la solicitud antes de enviar.
 */

/**
 * Una solicitud idéntica (mismos sats y misma dirección) mientras la anterior sigue en revisión y dentro de este
 * tiempo es un doble clic o un reintento de la red: se responde con la que ya existe, no se crea otra.
 */
const REPEAT_WINDOW_MS = 2 * 60_000;

const withdrawalCode = () => `RET-${orderCode().slice(4)}`;

/**
 * Los sats ya retirados más los que están en revisión. Va dentro de la sentencia que aparta el saldo:
 * así dos solicitudes simultáneas no pueden retirar los mismos sats.
 */
const committedSql = (userId: string) => sql`(
  SELECT coalesce(sum(amount_sats), 0) FROM ledger_tx
  WHERE user_id = ${userId} AND kind = 'retiro' AND status IN ('confirmada', 'por_aprobar')
)`;

/** El mismo retiro a la misma dirección, pedido hace menos de REPEAT_WINDOW_MS y todavía en revisión. */
const repeatedSql = (userId: string, amountSats: number, address: string, now: number) => sql`
  SELECT id FROM ledger_tx
  WHERE user_id = ${userId} AND kind = 'retiro' AND status = 'por_aprobar' AND amount_sats = ${amountSats}
    AND wallet_address = ${address} AND created_at > ${now - REPEAT_WINDOW_MS}
  ORDER BY created_at DESC LIMIT 1`;

async function repeatedWithdrawal(userId: string, amountSats: number, address: string, now: number) {
  const [row] = await db.all<{ id: string }>(repeatedSql(userId, amountSats, address, now));
  return row ? getWithdrawal(userId, row.id) : null;
}

/** Pide un retiro en BTC. Queda de una vez en revisión, con los sats apartados. */
export async function createBtcWithdrawal(input: { userId: string; amountSats: number; address: string }) {
  const now = Date.now();
  await requireCompleteProfile(input.userId);
  const dest = parseBtcAddress(input.address, { allowTestnet: isDemoMode() });
  if (!dest.ok) throw new MarketError(dest.error, 400, { fields: { address: dest.error } });
  const amountSats = Math.floor(input.amountSats);
  // Doble clic o reintento después de que la primera ya quedó guardada: se responde con esa.
  const repeated = await repeatedWithdrawal(input.userId, amountSats, dest.address, now);
  if (repeated) return repeated;
  await requireNoPaymentReview(input.userId);
  if (!Number.isFinite(amountSats) || amountSats < MIN_WITHDRAWAL_SATS) {
    const msg = `El retiro mínimo es de ${formatSats(MIN_WITHDRAWAL_SATS)}.`;
    throw new MarketError(msg, 400, { fields: { amountSats: msg } });
  }
  const bal = await getBalance(input.userId, now);
  if (amountSats > bal.balance) throw new MarketError("No tienes saldo suficiente para ese retiro.");
  // Lo minado solo crece con el tiempo: el tope calculado ahora sigue siendo válido al apartar los sats.
  const minedSats = Math.floor(bal.minedSats);
  const rates = await getRates();
  const amountCop = Math.floor((amountSats * rates.prices.BTC.cop) / 100_000_000);
  const network = dest.network === "testnet" ? "Bitcoin (testnet)" : "Bitcoin";
  const id = withdrawalCode();
  // Una sola sentencia: aparta los sats y, si en el mismo instante entró la misma solicitud, no la duplica.
  const res = await db.run(sql`
    INSERT INTO ledger_tx (id, user_id, kind, status, amount_cop, amount_sats, asset, asset_amount, network, wallet_address, created_at)
    SELECT ${id}, ${input.userId}, 'retiro', 'por_aprobar', ${amountCop}, ${amountSats}, 'BTC', ${amountSats / 100_000_000}, ${network}, ${dest.address}, ${now}
    WHERE ${committedSql(input.userId)} + ${amountSats} <= ${minedSats}
      AND ${noPaymentReviewSql(input.userId)}
      AND NOT EXISTS (${repeatedSql(input.userId, amountSats, dest.address, now)})
  `);
  if (!res.rowsAffected) {
    const twin = await repeatedWithdrawal(input.userId, amountSats, dest.address, now);
    if (twin) return twin;
    throw new MarketError("No tienes saldo suficiente para ese retiro.", 409);
  }
  alertWithdrawalRequested({ id, userId: input.userId, amountSats, address: dest.address });
  return getWithdrawal(input.userId, id);
}

export async function getWithdrawal(userId: string, withdrawalId: string) {
  const [tx] = await db
    .select()
    .from(ledgerTx)
    .where(
      and(
        eq(ledgerTx.id, withdrawalId),
        eq(ledgerTx.userId, userId),
        eq(ledgerTx.kind, "retiro"),
      ),
    );
  if (!tx) throw new MarketError("Retiro no encontrado", 404);
  return toTxDTO(tx);
}

/** Recuerda la última wallet que conectó el usuario. */
export async function linkWallet(
  userId: string,
  w: { address: string; walletName: string; chainId: number | null },
) {
  const values = {
    address: w.address,
    walletName: w.walletName,
    chainId: w.chainId,
    connectedAt: Date.now(),
  };
  await db
    .insert(walletLink)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: walletLink.userId, set: values });
}
