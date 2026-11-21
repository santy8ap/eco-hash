"use client";
import type { BtcPrice } from "@/lib/btc-price";
import { formatCop, formatNumber } from "@/lib/format";

/**
 * El precio del BTC en pesos. Cada precio nuevo vuelve a montar la cifra (key) para que el destello verde o coral
 * arranque otra vez. No es una región aria-live: un lector de pantalla no tiene que anunciar un precio por segundo.
 */
export function LivePrice({ price }: { price: BtcPrice }) {
  return (
    <span key={price.updatedAt} className="price-tick" data-dir={price.dir}>
      {formatCop(price.cop)}
    </span>
  );
}

/** De dónde sale el precio: en vivo (Coinbase), de CoinGecko o de referencia. */
export function LivePriceNote({ price }: { price: BtcPrice }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      US$ {formatNumber(price.usd, price.live ? 2 : 0)}
      {price.live ? (
        <>
          <span className="live-dot scale-75" aria-hidden="true" />
          en vivo
        </>
      ) : price.reference ? (
        ", referencia"
      ) : null}
    </span>
  );
}
