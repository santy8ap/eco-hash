import "server-only";
import { paymentMethodLabel } from "@/lib/labels";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import { BRAND } from "@/config/brand";
import { db } from "@/lib/db";
import { ledgerTx } from "@/lib/db/schema";
import { MarketError } from "@/lib/errors";
import { formatBtc, formatCop, formatDateTime, formatHashprice, formatSats, formatTh } from "@/lib/format";
import { getSubscription } from "@/lib/plans/service";
import { getProfile } from "@/lib/profile";

export interface ReceiptData {
  id: string;
  kind: string;
  amountCop: number;
  confirmedAt: number;
  holder: string;
  document: string;
  planName: string | null;
  periodIndex: number | null;
  months: number | null;
  /** Hashrate del mes pagado (TH/s) */
  hashrateTh: number | null;
  priceCopPerThMonth: number | null;
  /** Hashprice que fijó ese mes al activarse (sats por TH/s al día) */
  satsPerThDay: number | null;
  /** Retiro: sats enviados y la dirección de destino */
  amountSats: number | null;
  address: string | null;
  method: string;
  reference: string | null;
  test: boolean;
}

/** Nunca expone movimientos ajenos ni emite una constancia de pago pendiente o devuelto. */
export async function receiptData(
  userId: string,
  id: string,
): Promise<ReceiptData> {
  const [tx] = await db
    .select()
    .from(ledgerTx)
    .where(and(eq(ledgerTx.id, id), eq(ledgerTx.userId, userId)));
  if (!tx)
    throw new MarketError("No encontramos ese movimiento en tu cuenta.", 404);
  if (
    tx.status !== "confirmada" ||
    ["refunded", "charged_back", "cancelled"].includes(tx.providerStatus ?? "")
  )
    throw new MarketError(
      "El comprobante está disponible cuando el pago o retiro queda confirmado.",
      409,
    );
  const [profile, sub] = await Promise.all([
    getProfile(userId),
    tx.subscriptionId ? getSubscription(tx.subscriptionId) : null,
  ]);
  if (!profile?.fullName)
    throw new MarketError(
      "Completa tus datos personales para emitir el comprobante.",
      412,
    );
  return {
    id: tx.id,
    kind: tx.kind,
    amountCop: tx.amountCop,
    confirmedAt: tx.confirmedAt ?? tx.createdAt,
    holder: profile.fullName,
    document: `${profile.docType} ${profile.docNumber}`,
    planName: sub?.planName ?? null,
    periodIndex: tx.periodIndex,
    months: sub?.months ?? null,
    hashrateTh: tx.hashrateTh ?? null,
    priceCopPerThMonth: sub?.priceCopPerThMonth ?? null,
    satsPerThDay: sub?.periods.find((p) => p.txId === tx.id)?.satsPerThDay ?? null,
    amountSats: tx.kind === "retiro" ? (tx.amountSats ?? null) : null,
    address: tx.kind === "retiro" ? tx.walletAddress : null,
    method:
      paymentMethodLabel(tx.method) || (tx.kind === "retiro" ? "Retiro" : "Pago"),
    reference: tx.providerId ?? tx.txHash,
    test:
      tx.method === "demo" ||
      tx.chainId === 97 ||
      /pruebas/i.test(tx.network ?? ""),
  };
}

let fontBytes: Promise<Buffer> | undefined;

/** PDF con fuente Unicode embebida: nombres y tildes se conservan en el documento. */
export async function renderReceipt(data: ReceiptData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Comprobante ${data.id} - ${BRAND.name}`);
  pdf.setAuthor(BRAND.name);
  pdf.setCreationDate(new Date(data.confirmedAt));
  pdf.registerFontkit(fontkit);
  fontBytes ??= readFile(
    path.join(process.cwd(), "src/assets/receipt-font.ttf"),
  );
  const font = await pdf.embedFont(await fontBytes, { subset: true });
  let page = pdf.addPage([595.28, 841.89]);
  let y = 790;
  const margin = 46;
  const width = 595.28 - margin * 2;
  const text = (value: string, size = 10, muted = false) => {
    const lines = wrap(value, font, size, width);
    for (const line of lines) {
      if (y < 70) {
        page = pdf.addPage([595.28, 841.89]);
        y = 790;
      }
      page.drawText(line, {
        x: margin,
        y,
        size,
        font,
        color: muted ? rgb(0.38, 0.38, 0.38) : rgb(0.04, 0.04, 0.04),
      });
      y -= size * 1.55;
    }
  };
  const rule = () => {
    y -= 8;
    page.drawLine({
      start: { x: margin, y },
      end: { x: margin + width, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 25;
  };
  const field = (label: string, value: string) => {
    text(label.toUpperCase(), 8, true);
    text(value, 11);
    y -= 9;
  };
  text(BRAND.name, 22);
  text("COMPROBANTE DE OPERACIÓN", 9, true);
  rule();
  if (data.test) {
    text("OPERACIÓN DE PRUEBA - SIN MOVIMIENTO DE DINERO REAL", 9);
    y -= 12;
  }
  field("Referencia", data.id);
  field(
    "Fecha de confirmación - hora de Colombia",
    formatDateTime(data.confirmedAt),
  );
  field("Titular registrado", data.holder);
  field("Documento", data.document);
  rule();
  if (data.planName)
    field(
      "Plan",
      `${data.planName}${data.periodIndex ? ` - mes ${data.periodIndex} de ${data.months}` : ""}`,
    );
  if (data.hashrateTh != null) field("Hashrate de este mes", `${formatTh(data.hashrateTh)} durante 30 días`);
  if (data.priceCopPerThMonth != null) field("Precio contratado", `${formatCop(data.priceCopPerThMonth)} COP por TH/s al mes`);
  if (data.satsPerThDay != null && data.hashrateTh != null) {
    field("Hashprice fijado para este mes", formatHashprice(data.satsPerThDay));
    field("Minería esperada del mes", formatSats(data.hashrateTh * data.satsPerThDay * 30));
  }
  if (data.address) field("Dirección Bitcoin de destino", data.address);
  field("Medio de la operación", data.method);
  if (data.reference) field(data.kind === "retiro" ? "Txid del envío" : "Referencia del proveedor", data.reference);
  rule();
  if (data.kind === "retiro" && data.amountSats != null) {
    text("VALOR DEL RETIRO ENVIADO", 8, true);
    y -= 12;
    text(formatSats(data.amountSats), 24);
    y -= 8;
    text(`${formatBtc(data.amountSats)} · equivalente al pedirlo: ${formatCop(data.amountCop)} COP`, 10, true);
  } else {
    text(data.kind === "retiro" ? "VALOR DEL RETIRO CONFIRMADO" : "VALOR DEL PAGO CONFIRMADO", 8, true);
    y -= 12;
    text(`${formatCop(data.amountCop)} COP`, 24);
  }
  y -= 20;
  text(
    "Documento informativo de una operación confirmada. No sustituye una factura fiscal. El precio y el hashrate del plan son los contratados; los sats minados dependen del hashprice de cada mes.",
    8,
    true,
  );
  return pdf.save();
}

function wrap(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let current = "";
  for (let word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = "";
    }
    while (font.widthOfTextAtSize(word, size) > maxWidth) {
      const characters = Array.from(word);
      let length = 1;
      while (
        length < characters.length &&
        font.widthOfTextAtSize(
          characters.slice(0, length + 1).join(""),
          size,
        ) <= maxWidth
      )
        length++;
      lines.push(characters.slice(0, length).join(""));
      word = characters.slice(length).join("");
    }
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}
