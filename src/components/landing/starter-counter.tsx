"use client";
import { PLANS } from "@/config/plans";
import { useCatalog } from "@/lib/client/use-catalog";
import { useSinceMount } from "@/lib/client/use-since-mount";
import { formatNumber, formatTh } from "@/lib/format";

const STARTER = PLANS[0];

/** Lo que un plan pequeño minó mientras la persona lee: la minería medida en segundos, con el hashprice de hoy. */
export function StarterCounter() {
  const { catalog } = useCatalog();
  const sinceOpen = useSinceMount(200);
  const sats = (STARTER.hashrateTh * catalog.satsPerThDay * sinceOpen) / 86_400_000;
  return (
    <p className="mt-6 text-sm text-mute" aria-live="off">
      Desde que abriste esta página, un plan {STARTER.name} ({formatTh(STARTER.hashrateTh)}) minó{" "}
      <span className="num font-medium text-amber-text">{formatNumber(sats, 3)} sats</span>.
    </p>
  );
}
