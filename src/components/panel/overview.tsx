"use client";
import Link from "next/link";
import { Download } from "lucide-react";
import { useState } from "react";
import { PLAN_MONTHS } from "@/config/plans";
import { downloadCsv } from "@/lib/csv";
import { isoColombiaDate } from "@/lib/history-filters";
import { useNetwork } from "@/lib/client/use-network";
import { satsPerSecond } from "@/lib/mining/plan-math";
import { dailyReturns } from "@/lib/mining/summary";
import { formatBtc, formatCop, formatDateTime, formatNumber, formatPct, formatSats, formatTh } from "@/lib/format";
import { PlanRow } from "@/components/plans/plan-row";
import { useProfile } from "@/components/profile/profile-form";
import { ErrorNote } from "@/components/ui/field";
import { Status, TX_STATUS } from "@/components/ui/status";
import { SatsChart } from "./sats-chart";
import { Topbar } from "./shell";
import { txAmount, txDetail, txTitle } from "./tx-meta";
import { usePortfolio } from "./use-portfolio";
import { useUser } from "./user-context";

function Readout({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="min-w-0 px-5 py-4 sm:px-6">
      <dt className="cap">{label}</dt>
      <dd className="num mt-1.5 truncate text-[1.3rem] text-ink">{value}</dd>
      {note && <dd className="mt-0.5 truncate text-xs text-mute">{note}</dd>}
    </div>
  );
}

const RANGES = [7, 30, 90] as const;

export function Overview() {
  const user = useUser();
  const profile = useProfile();
  // Cada 200 ms: el contador de sats se mueve como un odómetro.
  const { data, error, now, totals, balanceSats } = usePortfolio(200);
  const { data: net } = useNetwork();
  const [rangeDays, setRangeDays] = useState<(typeof RANGES)[number]>(7);
  const name = profile.data?.profile?.fullName?.split(" ")[0] || user.name.split(" ")[0];
  const btcCop = net?.btc.cop ?? null;

  if (!data || !totals) {
    return (
      <>
        <Topbar title={`Hola, ${name}`} />
        {error ? <ErrorNote>{error}</ErrorNote> : <div className="skeleton h-[420px]" aria-busy="true" aria-label="Cargando tu minería" />}
      </>
    );
  }

  const subs = data.subscriptions;
  if (!subs.length) {
    return (
      <>
        <Topbar title={`Hola, ${name}`} subtitle="Todavía no tienes hashrate minando." />
        <section className="panel grid grid-cols-[minmax(0,1fr)] gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <h2 className="display text-[clamp(1.8rem,3.6vw,2.4rem)]">Elige tu primer plan</h2>
            <p className="mt-3 max-w-[52ch] leading-relaxed text-fog">
              Contrata hashrate por {PLAN_MONTHS} meses y paga mes a mes. Cuando se confirme el primer pago, aquí verás tus sats sumando cada segundo.
            </p>
          </div>
          <Link href="/panel/planes" className="btn btn-solid">
            Ver los planes
          </Link>
        </section>
      </>
    );
  }

  const rate = now == null ? 0 : subs.reduce((s, p) => s + satsPerSecond(p.hashrateTh, p.periods, now), 0);
  const paused = subs.some((s) => s.state === "en_pausa");
  const idle = totals.activeTh === 0;
  const recent = data.transactions.slice(0, 5);
  const days = now == null ? [] : dailyReturns(subs, now, rangeDays);
  const minedValueCop = btcCop ? (totals.minedSats * btcCop) / 1e8 : null;
  const result = minedValueCop != null && totals.costCop > 0 ? (minedValueCop - totals.costCop) / totals.costCop : null;

  return (
    <>
      <Topbar
        title={`Hola, ${name}`}
        subtitle={idle ? (paused ? "Tu minería está en pausa: falta el pago del mes." : "Tus planes ya no están minando.") : "Así va tu minería en este momento."}
      />

      <section className="panel relative overflow-hidden p-5 sm:p-7" aria-label="Minado en total">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2.5 text-sm text-fog">
            <span className="live-dot" data-tone={idle ? (paused ? "wait" : "off") : undefined} />
            {idle ? (paused ? "En pausa" : "Detenido") : `Minando con ${formatTh(totals.activeTh)}`}
          </p>
          {!idle && <p className="num text-sm text-mute">+{formatNumber(rate, 4)} sats por segundo</p>}
        </div>
        <p className="cap mt-6">Minado en total</p>
        <p className="figure mt-2 text-[clamp(2.4rem,7vw,4.4rem)] text-ink" aria-live="off">
          {formatNumber(totals.minedSats, 2)} <span className="unit text-[0.36em] text-mute">sats</span>
        </p>
        <p className="num mt-2 text-sm text-fog">
          {formatBtc(totals.minedSats)}
          {minedValueCop != null && <span className="text-mute">, {formatCop(minedValueCop)} al precio de hoy</span>}
        </p>
      </section>

      <dl className="kpi-strip panel mt-3 grid grid-cols-2 lg:grid-cols-4">
        <Readout label="Hashrate activo" value={formatTh(totals.activeTh)} note={idle ? "sin un mes activo" : `${formatSats(totals.dailySats)} al día`} />
        <Readout label="Minado hoy" value={formatSats(totals.todaySats)} note="desde la medianoche" />
        <Readout
          label="Saldo disponible"
          value={formatSats(balanceSats)}
          note={data.reservedSats > 0 ? `${formatSats(data.reservedSats)} en retiros por enviar` : btcCop ? formatCop((balanceSats * btcCop) / 1e8) : undefined}
        />
        <Readout
          label="Resultado al precio de hoy"
          value={
            result == null ? (
              "—"
            ) : (
              <span className={result >= 0 ? "text-jade-text" : "text-coral"}>
                {result >= 0 ? "+" : "−"}
                {formatPct(Math.abs(result), 1)}
              </span>
            )
          }
          note={minedValueCop != null ? `${formatCop(minedValueCop)} minado, ${formatCop(totals.costCop)} pagado` : undefined}
        />
      </dl>

      <section className="panel mt-3 p-5 sm:p-6" aria-labelledby="daily-title">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="daily-title" className="text-lg font-semibold">
            Sats minados por día
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex rounded-[10px] border border-line p-0.5" role="group" aria-label="Período">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={rangeDays === r}
                  onClick={() => setRangeDays(r)}
                  className={`rounded-[8px] px-3 py-1.5 text-sm ${rangeDays === r ? "bg-seam font-medium text-ink" : "text-mute hover:text-ink"}`}
                >
                  {r} días
                </button>
              ))}
            </div>
            <button
              type="button"
              className="link inline-flex items-center gap-1.5 text-sm text-fog"
              disabled={!days.length}
              onClick={() =>
                downloadCsv(`eco-hash-mineria-${isoColombiaDate(days[0].dayStart)}.csv`, [
                  ["Fecha (Colombia)", "Sats", "BTC", "Costo proporcional COP"],
                  ...days.map((row) => [isoColombiaDate(row.dayStart), Math.floor(row.sats), (Math.floor(row.sats) / 1e8).toFixed(8), Math.round(row.costCop)]),
                ])
              }
            >
              <Download size={14} /> Exportar
            </button>
          </div>
        </div>
        {days.length ? <SatsChart rows={days} btcCop={btcCop} /> : <p className="mt-4 text-sm text-mute">Todavía no hay días con minería.</p>}
      </section>

      <section className="mt-12" aria-labelledby="planes-titulo">
        <div className="flex items-end justify-between gap-6 pb-4">
          <h2 id="planes-titulo" className="text-xl font-semibold">
            Tus planes
          </h2>
          <Link href="/panel/planes" className="link text-sm text-fog">
            Comprar otro plan
          </Link>
        </div>
        <ul className="grid gap-3">
          {subs.map((s) => (
            <PlanRow key={s.id} sub={s} now={now} />
          ))}
        </ul>
      </section>

      {/* La columna única del celular también es minmax(0,1fr): si no, el texto truncado de un movimiento ensancha la página. */}
      <section className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]" aria-label="Saldo y movimientos">
        <div className="panel p-5 sm:p-6">
          <p className="cap">Saldo disponible para retirar</p>
          <p className="figure mt-3 text-[clamp(2rem,4.5vw,2.8rem)]">
            {formatNumber(balanceSats)} <span className="unit text-[0.42em] text-mute">sats</span>
          </p>
          <p className="num mt-2 text-sm text-fog">{formatBtc(balanceSats)}</p>
          {data.reservedSats > 0 && <p className="mt-3 text-sm text-mute">Además, {formatSats(data.reservedSats)} en retiros que estamos enviando.</p>}
          <Link href="/panel/billetera" className="btn btn-solid mt-6">
            Retirar a mi billetera
          </Link>
        </div>
        <div className="panel p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-6">
            <h2 className="text-lg font-semibold">Últimos movimientos</h2>
            <Link href="/panel/billetera" className="link text-sm text-fog">
              Ver todos
            </Link>
          </div>
          <ul className="mt-2">
            {recent.map((t) => {
              const st = TX_STATUS[t.status] ?? TX_STATUS.pendiente;
              return (
                <li key={t.id} className="flex items-start justify-between gap-6 border-b border-line py-3.5 last:border-b-0">
                  <div className="min-w-0">
                    <p>{txTitle(t)}</p>
                    <p className="mt-0.5 truncate text-sm text-mute">
                      {formatDateTime(t.createdAt)}, {txDetail(t)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`num ${st.tone === "off" ? "text-dim line-through" : ""}`}>{txAmount(t) ?? formatCop(t.amountCop)}</p>
                    <p className="mt-1.5">
                      <Status tone={st.tone}>{st.label}</Status>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </>
  );
}
