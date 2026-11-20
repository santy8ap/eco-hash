"use client";
import { useState } from "react";
import { useNetwork } from "@/lib/client/use-network";
import { formatBtc, formatCop, formatNumber, formatSats } from "@/lib/format";
import { useProfile } from "@/components/profile/profile-form";
import { ErrorNote } from "@/components/ui/field";
import { Topbar } from "./shell";
import { TransactionHistory } from "./transaction-history";
import { usePortfolio } from "./use-portfolio";
import { WithdrawDialog } from "./withdraw-dialog";

/** Saldo en sats, retiros a una dirección Bitcoin e historial de pagos. */
export function WalletPage() {
  const { data, error, totals, balanceSats } = usePortfolio();
  const { data: net } = useNetwork();
  const profile = useProfile();
  const [withdrawing, setWithdrawing] = useState(false);
  const btcCop = net?.btc.cop ?? null;

  if (!data || !totals) {
    return (
      <>
        <Topbar title="Billetera" />
        {error ? <ErrorNote>{error}</ErrorNote> : <div className="skeleton h-[380px]" aria-busy="true" aria-label="Cargando tu billetera" />}
      </>
    );
  }

  return (
    <>
      <Topbar title="Billetera" subtitle="Tus sats, tus retiros a Bitcoin y los pagos de tus planes." />

      <section className="panel grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-end" aria-label="Saldo">
        <div>
          <p className="cap">Saldo disponible</p>
          <p className="figure mt-3 text-[clamp(2.6rem,7vw,4.4rem)]">
            {formatNumber(balanceSats)} <span className="unit text-[0.36em] text-mute">sats</span>
          </p>
          <p className="num mt-2 text-sm text-fog">
            {formatBtc(balanceSats)}
            {btcCop ? <span className="text-mute">, unos {formatCop((balanceSats * btcCop) / 1e8)} hoy</span> : null}
          </p>
          <button type="button" className="btn btn-solid mt-7" onClick={() => setWithdrawing(true)} disabled={balanceSats <= 0}>
            Retirar a mi billetera
          </button>
          {balanceSats <= 0 && <p className="mt-3 text-sm text-mute">Tu saldo crece a medida que tu hashrate mina.</p>}
        </div>
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-[12px] border border-line bg-line">
          {[
            ["Minado", formatSats(totals.minedSats)],
            ["Por enviar", formatSats(data.reservedSats)],
            ["Retirado", formatSats(data.withdrawnSats)],
          ].map(([label, value]) => (
            <div key={label} className="bg-raise px-4 py-3.5">
              <dt className="cap">{label}</dt>
              <dd className="num mt-1 whitespace-nowrap text-[1.02rem]">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <TransactionHistory asOf={data.asOf} />

      <WithdrawDialog open={withdrawing} onClose={() => setWithdrawing(false)} balanceSats={balanceSats} btcCop={btcCop} profile={profile.data?.profile ?? null} />
    </>
  );
}
