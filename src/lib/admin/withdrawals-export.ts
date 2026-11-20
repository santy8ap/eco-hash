import "server-only";
import { csvLine } from "@/lib/csv";
import { formatDateTime } from "@/lib/format";
import { txStatusLabel } from "@/lib/labels";
import type { listWithdrawals } from "./service";

type Row = Awaited<ReturnType<typeof listWithdrawals>>[number];

/** Los retiros en CSV para la contabilidad: a quién, a qué dirección, cuántos sats y con qué txid se enviaron. */
export function withdrawalsCsv(rows: readonly Row[]) {
  let csv =
    "﻿" +
    csvLine(["Solicitado (Colombia)", "Enviado o rechazado (Colombia)", "Retiro", "Cliente", "Titular", "NIT o documento", "Correo", "Dirección Bitcoin", "Estado", "Sats", "BTC", "Equivalente COP al pedirlo", "Txid", "Nota"]);
  for (const w of rows)
    csv += csvLine([
      formatDateTime(w.createdAt),
      w.confirmedAt ? formatDateTime(w.confirmedAt) : "",
      w.id,
      w.companyName || w.userName,
      w.fullName,
      w.customerId,
      w.userEmail,
      w.walletAddress,
      txStatusLabel(w.status),
      w.amountSats ?? "",
      w.amountSats != null ? (w.amountSats / 100_000_000).toFixed(8) : "",
      w.amountCop,
      w.status === "confirmada" ? w.txHash : "",
      w.note,
    ]);
  return csv;
}
