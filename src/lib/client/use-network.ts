"use client";
import type { NetworkStats } from "@/lib/network";
import { useJson } from "./use-json";

/** Lo que devuelve /api/network: la red Bitcoin y el precio del BTC. */
export interface NetworkDTO {
  network: NetworkStats;
  btc: { cop: number; usd: number; source: "coingecko" | "referencia"; updatedAt: number };
}

/** Datos de la red y precio del BTC, renovados cada minuto. */
export function useNetwork() {
  const { data, error } = useJson<NetworkDTO>("/api/network", { refreshMs: 60_000 });
  return { data: data ?? null, error };
}
