"use client";
import Link from "next/link";
import { Copy, ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useAppConfig } from "@/lib/client/use-app-config";
import { postJson, refetch, useJson } from "@/lib/client/use-json";
import { formatBtc, formatCop, formatDateTime, formatSats } from "@/lib/format";
import { explorerTxUrl } from "@/components/panel/tx-meta";
import { ErrorNote, Field } from "@/components/ui/field";
import { Status } from "@/components/ui/status";
import { toast } from "@/components/ui/toast";
import { AdminTopbar } from "./shell";
import type { AdminWithdrawal } from "./types";
import { OutboundLink } from "@/components/ui/outbound-link";

const LIST_URL = "/api/admin/withdrawals";

/** Un dato que el administrador va a pegar en su billetera: se copia con un toque. */
function CopyValue({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(
          () => toast(`${label}: copiado.`),
          () => toast("No se pudo copiar.", "error"),
        );
      }}
      className="num group inline-flex max-w-full items-start gap-2 text-left hover:text-ink"
      aria-label={`Copiar ${label.toLowerCase()}: ${value}`}
    >
      <span className="break-all">{value}</span>
      <Copy size={13} strokeWidth={1.5} className="mt-1 shrink-0 text-mute group-hover:text-ink" aria-hidden="true" />
    </button>
  );
}

function Datum({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="cap">{label}</dt>
      <dd className="mt-1.5 break-words">{children}</dd>
    </div>
  );
}

const ownerOf = (w: AdminWithdrawal) => w.companyName || w.fullName || w.userName;

function PendingWithdrawal({ w, realMoney }: { w: AdminWithdrawal; realMoney: boolean }) {
  const [mode, setMode] = useState<null | "aprobar" | "rechazar">(null);
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const btc = ((w.amountSats ?? 0) / 100_000_000).toFixed(8);

  const decide = async (decision: "aprobar" | "rechazar") => {
    setBusy(true);
    setError(null);
    try {
      await postJson(`${LIST_URL}/${w.id}`, { decision, reason, reference });
      toast(decision === "aprobar" ? `Retiro de ${formatSats(w.amountSats ?? 0)} registrado como enviado.` : "Retiro rechazado: los sats volvieron a su saldo.");
      void refetch(LIST_URL);
      void refetch("/api/admin/overview");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <li className="panel p-5 sm:p-7">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <div>
          <p className="cap">{ownerOf(w)}</p>
          <p className="figure mt-3 text-[clamp(2.2rem,5vw,3.2rem)]">
            {formatSats(w.amountSats ?? 0)}
          </p>
          <p className="num mt-2 text-sm text-fog">
            {formatBtc(w.amountSats ?? 0)}, unos {formatCop(w.amountCop)} cuando lo pidió
          </p>
          <p className="num mt-3 text-sm text-mute">
            Pedido el {formatDateTime(w.createdAt)}
            <br />
            {w.id}
          </p>
        </div>
        <div>
          <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-5 sm:grid-cols-[auto_minmax(0,1fr)]">
            <Datum label="Enviar">
              <CopyValue value={btc} label="Monto en BTC" />
            </Datum>
            <Datum label={`Dirección en ${w.network ?? "Bitcoin"}`}>{w.walletAddress ? <CopyValue value={w.walletAddress} label="Dirección" /> : "Sin registrar"}</Datum>
          </dl>
          <p className="mt-5 flex max-w-[62ch] items-start gap-2 text-sm leading-relaxed text-fog">
            <ShieldCheck size={15} strokeWidth={1.7} className="mt-0.5 shrink-0" aria-hidden="true" />
            Antes de enviar, confirma con {ownerOf(w)} que la dirección es suya. Un envío en Bitcoin no se puede reversar.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <button type="button" className={`btn ${mode === "aprobar" ? "btn-solid" : "btn-ghost"}`} aria-expanded={mode === "aprobar"} disabled={busy} onClick={() => setMode(mode === "aprobar" ? null : "aprobar")}>
              Ya lo envié
            </button>
            <button type="button" className={`btn ${mode === "rechazar" ? "btn-solid" : "btn-ghost"}`} aria-expanded={mode === "rechazar"} disabled={busy} onClick={() => setMode(mode === "rechazar" ? null : "rechazar")}>
              Rechazar
            </button>
          </div>

          {mode === "aprobar" && (
            <form
              className="mt-7 max-w-[520px] space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void decide("aprobar");
              }}
            >
              <Field
                label="Txid del envío"
                hint={`Los 64 caracteres de la transacción en Bitcoin. El cliente lo verá en sus movimientos y en el correo.${realMoney ? "" : " En modo de pruebas puedes dejarlo vacío."}`}
              >
                {(id, aria) => <input id={id} {...aria} value={reference} onChange={(e) => setReference(e.target.value.trim())} maxLength={64} autoComplete="off" spellCheck={false} className="field hash" />}
              </Field>
              <button type="submit" className="btn btn-solid" disabled={busy || (realMoney && !/^[0-9a-fA-F]{64}$/.test(reference.trim()))}>
                {busy ? "Guardando…" : "Confirmar el envío"}
              </button>
            </form>
          )}
          {mode === "rechazar" && (
            <form
              className="mt-7 max-w-[520px] space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void decide("rechazar");
              }}
            >
              <Field label="Motivo del rechazo" hint="El cliente lo verá en sus movimientos y los sats vuelven a su saldo.">
                {(id, aria) => <input id={id} {...aria} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} autoComplete="off" className="field" />}
              </Field>
              <button type="submit" className="btn btn-solid" disabled={busy || reason.trim().length < 4}>
                {busy ? "Guardando…" : "Confirmar el rechazo"}
              </button>
            </form>
          )}
          {error && <ErrorNote className="mt-5">{error}</ErrorNote>}
        </div>
      </div>
    </li>
  );
}

function ReviewedWithdrawal({ w }: { w: AdminWithdrawal }) {
  const paid = w.status === "confirmada";
  return (
    <li className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-2 border-b border-line py-4 last:border-b-0 sm:grid-cols-[12.5rem_minmax(0,1fr)_auto] sm:items-baseline">
      <p className="num whitespace-nowrap text-sm text-mute">{formatDateTime(w.confirmedAt ?? w.createdAt)}</p>
      <div className="min-w-0">
        <p className="font-medium">
          <Link href={`/admin/clientes/${encodeURIComponent(w.userId)}`} className="hover:underline">
            {ownerOf(w)}
          </Link>
        </p>
        <p className="hash mt-1 text-sm leading-relaxed text-mute">{w.walletAddress ?? "Sin dirección"}</p>
        {paid && w.txHash && (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-dim">
            <span className="hash">Txid {w.txHash}</span>
            {explorerTxUrl(w) && (
              <OutboundLink href={explorerTxUrl(w)!} className="link inline-flex min-h-6 items-center gap-1 text-fog">
                mempool.space <ExternalLink size={11} />
              </OutboundLink>
            )}
          </p>
        )}
        {!paid && w.note && <p className="mt-1 text-sm leading-relaxed text-fog">Motivo: {w.note}</p>}
      </div>
      <div className="flex items-baseline justify-between gap-6 sm:block sm:text-right">
        <p className={`num text-lg ${paid ? "" : "text-dim line-through"}`}>{formatSats(w.amountSats ?? 0)}</p>
        <p className="sm:mt-2">
          <Status tone={paid ? "ok" : "off"}>{paid ? "Enviado" : "Rechazado"}</Status>
        </p>
      </div>
    </li>
  );
}

export function AdminWithdrawals() {
  const { data, loading, error } = useJson<{ withdrawals: AdminWithdrawal[] }>(LIST_URL, { refreshMs: 10_000 });
  const { config } = useAppConfig();
  const realMoney = config ? !config.demoMode : true;
  const list = data?.withdrawals ?? [];
  const pending = list.filter((w) => w.status === "por_aprobar");
  const reviewed = list.filter((w) => w.status !== "por_aprobar").slice(0, 30);

  return (
    <>
      <AdminTopbar
        title="Retiros"
        subtitle="Cada retiro espera aquí con los sats apartados. Envías los BTC desde la billetera de eco-hash y registras el txid."
        action={
          <a href="/api/admin/withdrawals/export" className="link text-sm" download>
            Exportar todos los retiros (CSV)
          </a>
        }
      />
      {error && <ErrorNote className="mb-8">{error}</ErrorNote>}

      <section aria-labelledby="pending-title">
        <h2 id="pending-title" className="pb-4 text-xl font-semibold">
          Por enviar <span className="num text-mute">{pending.length}</span>
        </h2>
        {loading && !data ? (
          <div className="skeleton mt-6 h-40" aria-busy="true" aria-label="Cargando los retiros" />
        ) : pending.length ? (
          <ul className="grid gap-3">
            {pending.map((w) => (
              <PendingWithdrawal key={w.id} w={w} realMoney={realMoney} />
            ))}
          </ul>
        ) : (
          <p className="panel px-5 py-6 text-mute">No hay retiros esperando. Cuando un cliente pida uno, aparece aquí.</p>
        )}
      </section>

      {reviewed.length > 0 && (
        <section className="mt-14" aria-labelledby="reviewed-title">
          <h2 id="reviewed-title" className="pb-4 text-xl font-semibold">
            Revisados
          </h2>
          <ul className="panel px-5 sm:px-6">
            {reviewed.map((w) => (
              <ReviewedWithdrawal key={w.id} w={w} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
