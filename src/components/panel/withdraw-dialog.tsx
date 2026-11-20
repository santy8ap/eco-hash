"use client";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { parseBtcAddress } from "@/lib/btc-address";
import { useAppConfig } from "@/lib/client/use-app-config";
import { goToLoginIfSignedOut, invalidateJson, refetch, SESSION_CLOSED } from "@/lib/client/use-json";
import { formatBtc, formatCop, formatNumber, formatSats } from "@/lib/format";
import type { ProfileDTO } from "@/lib/profile";
import { MIN_WITHDRAWAL_SATS, parseWithdrawalSats } from "@/lib/withdrawal-schema";
import { ErrorNote, Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

type FieldName = "amountSats" | "address";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (goToLoginIfSignedOut(res)) throw new Error(SESSION_CLOSED);
  const json = (await res.json().catch(() => ({}))) as T & { error?: string; fields?: Partial<Record<FieldName, string>> };
  if (!res.ok) throw Object.assign(new Error(json.error ?? `Error ${res.status}`), { fields: json.fields });
  return json;
}

/** Solicitud de retiro de sats a una dirección Bitcoin del titular. Siempre la revisa el equipo antes de enviarla. */
export function WithdrawDialog({
  open,
  onClose,
  balanceSats,
  btcCop,
  profile,
}: {
  open: boolean;
  onClose(): void;
  balanceSats: number;
  btcCop: number | null;
  profile: ProfileDTO | null;
}) {
  const { config } = useAppConfig();
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sats = parseWithdrawalSats(amount) ?? 0;

  const close = () => {
    if (busy) return;
    setError(null);
    setFieldErrors({});
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errs: typeof fieldErrors = {};
    if (sats < MIN_WITHDRAWAL_SATS) errs.amountSats = `El retiro mínimo es de ${formatSats(MIN_WITHDRAWAL_SATS)}.`;
    else if (sats > balanceSats) errs.amountSats = `Tu saldo disponible es de ${formatSats(balanceSats)}.`;
    const dest = parseBtcAddress(address, { allowTestnet: !!config?.demoMode });
    if (!dest.ok) errs.address = dest.error;
    setFieldErrors(errs);
    if (Object.keys(errs).length || !dest.ok) return;
    try {
      setBusy(true);
      await post("/api/withdrawals", { amountSats: sats, address: dest.address });
      invalidateJson("/api/transactions");
      void refetch("/api/portfolio");
      toast("Retiro solicitado. Te avisamos cuando lo enviemos, con su txid.");
      setAmount("");
      setAddress("");
      setBusy(false);
      onClose();
    } catch (err) {
      const fields = (err as { fields?: typeof fieldErrors }).fields;
      if (fields) setFieldErrors(fields);
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const needsProfile = !profile?.complete;

  return (
    <Modal open={open} onClose={close} title="Retirar a tu billetera Bitcoin" wide>
      {needsProfile ? (
        <div>
          <p className="leading-relaxed text-fog">Para retirar necesitamos tus datos personales: el retiro sale a nombre del titular registrado.</p>
          <div className="mt-7 flex justify-end">
            <Link href="/panel/perfil" className="btn btn-solid" onClick={onClose}>
              Completar los datos
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-6">
          <Field label="Cuántos sats quieres retirar" error={fieldErrors.amountSats} hint={`Disponible: ${formatSats(balanceSats)}. Mínimo: ${formatSats(MIN_WITHDRAWAL_SATS)}.`}>
            {(id, aria) => (
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    id={id}
                    {...aria}
                    inputMode="numeric"
                    autoComplete="off"
                    value={amount}
                    onChange={(e) => {
                      const n = parseWithdrawalSats(e.target.value);
                      setAmount(n ? formatNumber(n) : "");
                      setFieldErrors((f) => ({ ...f, amountSats: undefined }));
                    }}
                    placeholder="0"
                    className="field num !pr-14 text-xl"
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-mute">sats</span>
                </div>
                <button type="button" className="btn btn-ghost px-3" onClick={() => setAmount(formatNumber(balanceSats))}>
                  Todo
                </button>
              </div>
            )}
          </Field>
          {sats > 0 && (
            <p className="num -mt-3 text-sm text-fog">
              {formatBtc(sats)}
              {btcCop ? <span className="text-mute">, unos {formatCop((sats * btcCop) / 1e8)} hoy</span> : null}
            </p>
          )}

          <Field
            label="Dirección Bitcoin de destino"
            error={fieldErrors.address}
            hint="Cópiala desde tu billetera. Empieza por bc1, 1 o 3. Los envíos en Bitcoin no se pueden reversar."
          >
            {(id, aria) => (
              <input
                id={id}
                {...aria}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setFieldErrors((f) => ({ ...f, address: undefined }));
                }}
                onBlur={() => {
                  if (!address.trim()) return;
                  const r = parseBtcAddress(address, { allowTestnet: !!config?.demoMode });
                  if (!r.ok) setFieldErrors((f) => ({ ...f, address: r.error }));
                }}
                placeholder="bc1q…"
                className="field hash text-[0.95rem]"
              />
            )}
          </Field>

          {error && <ErrorNote>{error}</ErrorNote>}
          <div>
            <p className="text-xs leading-relaxed text-mute">
              El equipo revisa cada retiro antes de enviarlo. Cuando salga, verás el txid en tus movimientos y te llegará por correo.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" className="btn btn-ghost" onClick={close} disabled={busy}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-solid" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Enviando…
                  </>
                ) : (
                  "Solicitar retiro"
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
