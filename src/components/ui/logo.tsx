import { BRAND } from "@/config/brand";

/**
 * La marca: un bloque ámbar con un «#» (hash) cuyo trazo superior es una ola: la minería y el agua que la mueve.
 */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="1.5" y="1.5" width="29" height="29" rx="8.5" fill="var(--color-amber)" />
      <g fill="none" stroke="var(--color-amber-ink)" strokeWidth="2.6" strokeLinecap="round">
        <path d="M13.2 8.6 11.4 23.4" />
        <path d="M20.6 8.6 18.8 23.4" />
        <path d="M8.2 13.6q3.9-2.9 7.8 0t7.8 0" />
        <path d="M8 19.2h15.8" />
      </g>
    </svg>
  );
}

export function Logo({ className = "", size = "compact" }: { className?: string; size?: "compact" | "header" }) {
  const header = size === "header";
  return (
    <span className={`inline-flex items-center gap-2.5 text-ink ${className}`}>
      <LogoMark size={header ? 34 : 28} />
      {/* El guion de «eco-hash» no debe partir el nombre en dos líneas. */}
      <span className={`display whitespace-nowrap font-semibold tracking-[-0.03em] ${header ? "text-[1.3rem]" : "text-[1.12rem]"}`}>{BRAND.name}</span>
    </span>
  );
}
