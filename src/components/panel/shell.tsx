"use client";
import { Cpu, LayoutDashboard, LifeBuoy, LogOut, ShieldCheck, UserRound, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { signOut } from "@/app/ingresar/actions";
import { BRAND } from "@/config/brand";
import { useAppConfig } from "@/lib/client/use-app-config";
import { useBtcPrice } from "@/lib/client/use-btc-price";
import { useNetwork } from "@/lib/client/use-network";
import { formatNumber } from "@/lib/format";
import { LivePrice } from "@/components/ui/live-price";
import { Logo, LogoMark } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { ThemeSelector } from "@/components/ui/theme-selector";
import { useUser } from "./user-context";
import { NotificationsLink } from "./notifications-link";

export const NAV = [
  { href: "/panel", label: "Resumen", icon: LayoutDashboard },
  { href: "/panel/planes", label: "Planes", icon: Cpu },
  { href: "/panel/billetera", label: "Billetera", icon: Wallet },
  { href: "/panel/perfil", label: "Mis datos", icon: UserRound },
] as const;

function isActive(path: string, href: string) {
  return href === "/panel" ? path === "/panel" : path.startsWith(href);
}

const itemClass = (active: boolean) =>
  `relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[0.95rem] transition-colors ${
    active ? "bg-seam font-medium text-ink before:absolute before:-left-3 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-amber" : "text-mute hover:bg-seam/60 hover:text-ink"
  }`;

export function Sidebar() {
  const path = usePathname();
  const user = useUser();
  const [pending, start] = useTransition();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-line bg-raise px-4 py-6 lg:flex" aria-label="Menú del panel">
      <Link href="/" className="px-3" aria-label={`${BRAND.name}, inicio`}>
        <Logo />
      </Link>
      <nav className="mt-10 flex flex-col gap-1" aria-label="Panel">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={itemClass(active)}>
              <Icon size={18} strokeWidth={1.7} className={active ? "text-amber-text" : undefined} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-1 border-t border-line pt-4">
        <Link href="/panel/perfil" className="mb-2 flex items-center gap-3 rounded-[10px] px-3 py-2 hover:bg-seam/60">
          <Avatar name={user.name} image={user.image} size={32} />
          <span className="min-w-0">
            <span className="sr-only">Mis datos: </span>
            <span className="block truncate text-sm text-ink">{user.name}</span>
            <span className="block truncate text-xs text-mute">{user.email}</span>
          </span>
        </Link>
        <Link href="/ayuda" className={itemClass(false)}>
          <LifeBuoy size={18} strokeWidth={1.7} /> Centro de ayuda
        </Link>
        {user.canAdmin && (
          <Link href="/admin" className={itemClass(false)}>
            <ShieldCheck size={18} strokeWidth={1.7} />
            Administración
          </Link>
        )}
        <button type="button" disabled={pending} onClick={() => start(() => signOut())} className={`${itemClass(false)} text-left`}>
          <LogOut size={18} strokeWidth={1.7} />
          {pending ? "Saliendo…" : "Salir"}
        </button>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-raise/95 backdrop-blur-md lg:hidden" aria-label="Panel">
      <ul className="mx-auto grid max-w-[560px] grid-cols-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <li key={href} className="min-w-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 pb-2.5 pt-2.5 text-[0.7rem] ${active ? "text-ink" : "text-mute"}`}
              >
                <span className={`flex h-7 w-12 items-center justify-center rounded-full ${active ? "bg-amber-soft text-amber-text" : ""}`}>
                  <Icon size={19} strokeWidth={1.7} />
                </span>
                <span className="max-w-full break-words px-1 text-center">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** En celular no hay barra lateral: la marca y la salida van arriba. */
export function MobileBar() {
  const user = useUser();
  const [pending, start] = useTransition();
  return (
    <header className="flex items-center justify-between border-b border-line bg-raise px-4 py-3 lg:hidden">
      {/* En pantallas muy angostas (320 px) solo cabe el símbolo junto a los botones de la cuenta. */}
      <Link href="/" aria-label={`${BRAND.name}, inicio`} className="shrink-0">
        <LogoMark size={28} className="min-[400px]:hidden" />
        <Logo className="max-[399px]:hidden" />
      </Link>
      <div className="flex items-center gap-2 text-sm text-mute sm:gap-3">
        <Link href="/panel/perfil" className="inline-flex min-h-11 min-w-11 items-center justify-center hover:opacity-80">
          <Avatar name={user.name} image={user.image} size={28} />
          <span className="sr-only">Mis datos, {user.name}</span>
        </Link>
        <NotificationsLink />
        {user.canAdmin && (
          <Link href="/admin" className="inline-flex min-h-11 items-center px-1 hover:text-ink">
            Admin
          </Link>
        )}
        <button type="button" disabled={pending} onClick={() => start(() => signOut())} className="inline-flex min-h-11 items-center px-1 hover:text-ink">
          {pending ? "Saliendo…" : "Salir"}
        </button>
        <ThemeSelector />
      </div>
    </header>
  );
}

/** Indica que está habilitada la opción de pago de prueba. */
export function TestModeBar() {
  const { config } = useAppConfig();
  if (!config?.demoMode) return null;
  return (
    <section aria-label="Modo de pruebas" className="border-b border-amber/30 bg-amber-soft px-4 py-1.5 text-center text-xs font-medium text-amber-text">
      <p>Modo de pruebas: los pagos de prueba no mueven dinero real. Cada movimiento dice con qué medio se pagó.</p>
    </section>
  );
}

/** La red Bitcoin en una línea: el último bloque y el precio del BTC en vivo. */
export function NetworkTicker({ className = "" }: { className?: string }) {
  const { data } = useNetwork();
  const btc = useBtcPrice();
  const reference = data?.network.source === "referencia" || Boolean(btc?.reference);
  return (
    <p className={`flex items-center gap-3 text-sm text-mute ${className}`} aria-label="Red Bitcoin">
      <span className="live-dot" data-tone={!data ? "off" : reference ? "wait" : undefined} />
      <span>
        Bloque <span className="num text-ink">{data ? formatNumber(data.network.height) : "…"}</span>
      </span>
      <span className="hidden sm:inline">
        BTC <span className="num text-ink">{btc ? <LivePrice price={btc} /> : "…"}</span>
      </span>
      {reference && <span className="text-xs">(referencia)</span>}
    </p>
  );
}

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pb-8">
      <div className="min-w-0">
        <h1 className="display text-[clamp(2rem,4.4vw,3rem)]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-[60ch] text-fog">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <NetworkTicker />
        <span className="hidden lg:block">
          <NotificationsLink />
        </span>
        <div className="hidden lg:block">
          <ThemeSelector />
        </div>
      </div>
    </header>
  );
}
