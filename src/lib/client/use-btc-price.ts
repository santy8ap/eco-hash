"use client";
import { useSyncExternalStore } from "react";
import { combineBtcPrice, type BtcPrice } from "@/lib/btc-price";
import { getBtcTick, getServerBtcTick, subscribeBtcFeed } from "./btc-feed";
import { useNetwork } from "./use-network";

/** El precio del BTC: operación por operación desde Coinbase y, mientras conecta o si falla, el de /api/network. */
export function useBtcPrice(): BtcPrice | null {
  const { data } = useNetwork();
  const tick = useSyncExternalStore(subscribeBtcFeed, getBtcTick, getServerBtcTick);
  return combineBtcPrice(data?.btc ?? null, tick);
}

/** El precio en pesos con el que se puede estimar: en vivo o de CoinGecko, nunca el de referencia. */
export function useBtcCop(): number | null {
  const price = useBtcPrice();
  return price && !price.reference ? price.cop : null;
}
