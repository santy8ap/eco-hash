"use client";
import { useMemo, useState } from "react";
import { PLANS } from "@/config/plans";
import { goToLoginIfSignedOut, refetch, SESSION_CLOSED, useJson } from "@/lib/client/use-json";
import { useNetwork } from "@/lib/client/use-network";
import { catalogFrom, validateSettings, type FarmSettings } from "@/lib/farm-settings";
import { formatCop, formatDateTime, formatHashprice, formatHashrate, formatNumber, formatPct, formatTh } from "@/lib/format";
import { estimateReturn } from "@/lib/mining/plan-math";
import { ErrorNote, Field } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { AdminTopbar } from "./shell";
import type { OverviewDTO } from "./types";

/** "30.000" o "30000" → 30000; "41,5" → 41.5. Vacío o con letras → NaN, y la validación lo explica. */
function toNumber(text: string) {
  const clean = text.replace(/[.\s]/g, "").replace(",", ".");
  return /^\d+(\.\d+)?$/.test(clean) ? Number(clean) : Number.NaN;
}

async function saveSettings(next: Omit<FarmSettings, "updatedAt">) {
  const res = await fetch("/api/admin/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  });
  if (goToLoginIfSignedOut(res)) throw new Error(SESSION_CLOSED);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "No se pudo guardar.");
  return json as FarmSettings;
}

function FarmForm({ initial, contractedTh }: { initial: FarmSettings; contractedTh: number }) {
  const { data: net } = useNetwork();
  const [name, setName] = useState(initial.name);
  const [location, setLocation] = useState(initial.location);
  const [capacity, setCapacity] = useState(formatNumber(initial.capacityTh));
  const [hashprice, setHashprice] = useState(formatNumber(initial.satsPerThDay, Number.isInteger(initial.satsPerThDay) ? 0 : 1));
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(PLANS.map((p) => [p.id, String(initial.planPrices[p.id] ?? p.priceCopPerThMonth)])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = useMemo(
    () => ({
      name: name.trim(),
      location: location.trim(),
      capacityTh: toNumber(capacity),
      satsPerThDay: toNumber(hashprice),
      planPrices: Object.fromEntries(PLANS.map((p) => [p.id, toNumber(prices[p.id] ?? "")])),
    }),
    [name, location, capacity, hashprice, prices],
  );
  const problem = validateSettings({ ...next, updatedAt: null }, { contractedTh });
  const dirty =
    next.name !== initial.name ||
    next.location !== initial.location ||
    next.capacityTh !== initial.capacityTh ||
    next.satsPerThDay !== initial.satsPerThDay ||
    PLANS.some((p) => next.planPrices[p.id] !== initial.planPrices[p.id]);

  const hashpriceOk = Number.isFinite(next.satsPerThDay) && next.satsPerThDay > 0;
  // La economía de cada plan con lo que hay escrito; si un precio no es un número, esa fila queda sin cifras.
  const preview = catalogFrom({
    satsPerThDay: hashpriceOk ? next.satsPerThDay : initial.satsPerThDay,
    planPrices: Object.fromEntries(PLANS.map((p) => [p.id, Number.isFinite(next.planPrices[p.id]) ? next.planPrices[p.id] : 0])),
  });
  const networkHashprice = net && net.network.source === "mempool" ? Math.round(net.network.networkHashpriceSats * 10) / 10 : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) return;
    setBusy(true);
    setError(null);
    try {
      await saveSettings(next);
      toast("Cambios guardados. Los meses que se activen desde ahora usan estos valores.");
      await Promise.all([refetch("/api/admin/overview"), refetch("/api/plans")]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <section className="panel grid gap-x-8 gap-y-6 p-5 sm:grid-cols-2 sm:p-7" aria-labelledby="granja-datos">
        <h2 id="granja-datos" className="text-lg font-semibold sm:col-span-2">
          La granja
        </h2>
        <Field label="Nombre">{(id, aria) => <input id={id} {...aria} value={name} onChange={(e) => setName(e.target.value)} className="field" maxLength={60} />}</Field>
        <Field label="Ubicación">{(id, aria) => <input id={id} {...aria} value={location} onChange={(e) => setLocation(e.target.value)} className="field" maxLength={80} />}</Field>
        <Field label="Capacidad que se puede vender (TH/s)" hint={`Ya hay ${formatHashrate(contractedTh)} contratados: la capacidad no puede ser menor.`}>
          {(id, aria) => <input id={id} {...aria} inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="field num" />}
        </Field>
        <Field
          label="Hashprice (sats por TH/s al día)"
          hint="Cada mes que se activa desde ahora mina con este valor; los meses ya activos conservan el suyo."
        >
          {(id, aria) => (
            <div className="flex items-center gap-3">
              <input id={id} {...aria} inputMode="decimal" value={hashprice} onChange={(e) => setHashprice(e.target.value)} className="field num" />
              {networkHashprice != null && (
                <button type="button" className="btn btn-ghost shrink-0 px-3 text-sm" onClick={() => setHashprice(formatNumber(networkHashprice, 1))}>
                  Usar el de la red ({formatNumber(networkHashprice, 1)})
                </button>
              )}
            </div>
          )}
        </Field>
      </section>

      <section className="panel p-5 sm:p-7" aria-labelledby="granja-precios">
        <h2 id="granja-precios" className="text-lg font-semibold">
          Precios de los planes
        </h2>
        <p className="mt-1 text-sm text-mute">
          Precio por TH/s al mes, en pesos. Cada plan comprado conserva su precio{net ? `; la estimación usa el BTC a ${formatCop(net.btc.cop)}` : ""}.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-mute">
                <th scope="col" className="pb-3 font-normal">Plan</th>
                <th scope="col" className="pb-3 font-normal">Precio por TH/s</th>
                <th scope="col" className="pb-3 text-right font-normal">Mensualidad</th>
                <th scope="col" className="pb-3 text-right font-normal">Sats al mes</th>
                <th scope="col" className="pb-3 text-right font-normal">Para el cliente, al BTC de hoy</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((plan) => {
                const est = net && plan.monthlyCop > 0 ? estimateReturn(plan, net.btc.cop) : null;
                return (
                  <tr key={plan.id} className="border-t border-line">
                    <th scope="row" className="py-3 pr-4 text-left font-medium">
                      {plan.name} <span className="num text-mute">{formatTh(plan.hashrateTh)}</span>
                    </th>
                    <td className="py-3 pr-4">
                      <label className="sr-only" htmlFor={`price-${plan.id}`}>
                        Precio por TH/s del plan {plan.name}
                      </label>
                      <input
                        id={`price-${plan.id}`}
                        inputMode="numeric"
                        value={prices[plan.id] ?? ""}
                        onChange={(e) => setPrices({ ...prices, [plan.id]: e.target.value })}
                        className="field num max-w-[9rem] !py-2"
                      />
                    </td>
                    <td className="num py-3 text-right">{plan.monthlyCop > 0 ? formatCop(plan.monthlyCop) : "—"}</td>
                    <td className="num py-3 text-right">{formatNumber(plan.monthlySats)}</td>
                    <td className="num py-3 text-right">
                      {est ? (
                        <span className={est.profitPct >= 0 ? "text-jade-text" : "text-coral"}>
                          {est.profitPct >= 0 ? "+" : "−"}
                          {formatPct(Math.abs(est.profitPct), 1)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {problem && dirty && <ErrorNote>{problem}</ErrorNote>}
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <p className="text-sm text-mute">
          {initial.updatedAt ? `Última modificación: ${formatDateTime(initial.updatedAt)}.` : "Valores iniciales, sin cambios todavía."} Hashprice vigente:{" "}
          {formatHashprice(initial.satsPerThDay)}.
        </p>
        <button type="submit" className="btn btn-solid" disabled={busy || !dirty || !!problem}>
          {busy ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

export function AdminFarm() {
  const { data, error } = useJson<OverviewDTO>("/api/admin/overview");
  return (
    <>
      <AdminTopbar title="Granja" subtitle="Capacidad, hashprice y precios de los planes. Los cambios aplican a los meses que se activen desde ahora." />
      {data ? (
        <FarmForm key={data.settings.updatedAt ?? 0} initial={data.settings} contractedTh={data.contractedTh} />
      ) : error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : (
        <div className="skeleton h-[420px]" aria-busy="true" />
      )}
    </>
  );
}
