"use client";
import { ArrowLeftCircle, Bitcoin, Building2, ChartColumn, CreditCard, Ellipsis, Factory, History, LayoutGrid, LogOut, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { signOut } from "@/app/ingresar/actions";
import { BRAND } from "@/config/brand";
import { ADMIN_ROLE_LABEL } from "@/lib/admin/roles";
import { useJson } from "@/lib/client/use-json";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/logo";
import { ThemeSelector } from "@/components/ui/theme-selector";
import { useUser } from "@/components/panel/user-context";

export const ADMIN_NAV = [
  { href: "/admin", label: "Resumen", icon: LayoutGrid },
  { href: "/admin/analisis", label: "Análisis", icon: ChartColumn },
  { href: "/admin/clientes", label: "Clientes", icon: Building2 },
  { href: "/admin/pagos", label: "Pagos", icon: CreditCard },
  { href: "/admin/retiros", label: "Retiros", icon: Bitcoin },
  { href: "/admin/granja", label: "Granja", icon: Factory },
  { href: "/admin/equipo", label: "Equipo", icon: UsersRound },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings2 },
  { href: "/admin/actividad", label: "Actividad", icon: History },
] as const;

/** En celular caben cinco: las cuatro de todos los días y «Más» con el resto. */
const MOBILE_MAIN = new Set(["/admin", "/admin/clientes", "/admin/pagos", "/admin/retiros"]);

function isActive(path: string, href: string) {
  return href === "/admin" ? path === "/admin" : path.startsWith(href);
}

/** Cuántas cosas esperan al administrador: retiros por revisar, transferencias por confirmar y pagos por reembolsar. */
function usePending() {
  const { data } = useJson<{ pendingWithdrawals: number; paymentsToRefund: number; transfersToConfirm?: number }>("/api/admin/overview", { refreshMs: 15_000 });
  return { retiros: data?.pendingWithdrawals ?? 0, pagos: (data?.paymentsToRefund ?? 0) + (data?.transfersToConfirm ?? 0) };
}

const itemClass = (active: boolean) =>
  `relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[0.95rem] transition-colors ${
    active ? "bg-seam font-medium text-ink before:absolute before:-left-3 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-amber" : "text-mute hover:bg-seam/60 hover:text-ink"
  }`;

function Count({ n }: { n: number }) {
  if (!n) return null;
  return <span className="num ml-auto rounded-full bg-amber px-2 py-0.5 text-xs font-medium text-amber-ink">{n}</span>;
}

export function AdminSidebar() {
  const path = usePathname();
  const pending = usePending();
  const user = useUser();
  const [out, startOut] = useTransition();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col overflow-y-auto border-r border-line bg-raise px-4 py-6 lg:flex" aria-label="Menú de administración">
      <Link href="/" className="px-3" aria-label={`${BRAND.name}, inicio`}>
        <Logo />
      </Link>
      <p className="cap mt-5 flex items-center gap-2 px-3 !text-amber-text">
        <ShieldCheck size={14} strokeWidth={1.7} /> Administración
      </p>
      <nav className="mt-6 flex flex-col gap-1" aria-label="Administración">
        {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={itemClass(active)}>
              <Icon size={18} strokeWidth={1.7} className={active ? "text-amber-text" : undefined} />
              {label}
              {href === "/admin/retiros" && <Count n={pending.retiros} />}
              {href === "/admin/pagos" && <Count n={pending.pagos} />}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col border-t border-line pt-4">
        <div className="mb-2 flex items-center gap-3 px-6 py-2">
          <Avatar name={user.name} image={user.image} size={32} />
          <span className="min-w-0">
            <span className="block truncate text-sm text-ink">{user.name}</span>
            <span className="block truncate text-xs text-mute">{user.email}</span>
            {user.adminRole && <span className="cap mt-0.5 block !text-[0.62rem]">{ADMIN_ROLE_LABEL[user.adminRole]}</span>}
          </span>
        </div>
        <Link href="/panel" className={itemClass(false)}>
          <ArrowLeftCircle size={18} strokeWidth={1.7} />
          Ir a mi panel de cliente
        </Link>
        <button type="button" disabled={out} onClick={() => startOut(() => signOut())} className={`${itemClass(false)} text-left`}>
          <LogOut size={18} strokeWidth={1.7} />
          {out ? "Cerrando sesión…" : "Cerrar sesión"}
        </button>
      </div>
    </aside>
  );
}

export function AdminBottomNav() {
  const path = usePathname();
  const pending = usePending();
  const user = useUser();
  // El menú «Más» queda abierto solo en la página donde se abrió: al navegar se cierra solo.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const more = openAt === path;
  const setMore = (open: boolean | ((v: boolean) => boolean)) => setOpenAt((typeof open === "function" ? open(more) : open) ? path : null);
  const sheet = useRef<HTMLDivElement>(null);
  const [out, startOut] = useTransition();
  const main = ADMIN_NAV.filter((n) => MOBILE_MAIN.has(n.href));
  const rest = ADMIN_NAV.filter((n) => !MOBILE_MAIN.has(n.href));
  const inRest = rest.some((n) => isActive(path, n.href));

  // Con Escape o tocando fuera, el menú «Más» se cierra.
  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenAt(null);
    const onDown = (e: PointerEvent) => {
      if (sheet.current && !sheet.current.contains(e.target as Node)) setOpenAt(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [more]);

  const cell = (active: boolean) => `relative flex w-full flex-col items-center gap-1 pb-2.5 pt-2.5 text-[0.66rem] ${active ? "text-amber-text" : "text-mute"}`;
  return (
    <div ref={sheet} className="lg:hidden">
      {more && (
        <div id="admin-more" className="fixed inset-x-0 bottom-[60px] z-40 border-t border-line-strong bg-raise/98 px-3 pb-2 backdrop-blur-md">
          <p className="mx-auto max-w-[640px] truncate border-b border-line px-6 py-3 text-xs text-mute">
            {user.email}
            {user.adminRole && <span className="cap ml-2 !text-ink">{ADMIN_ROLE_LABEL[user.adminRole]}</span>}
          </p>
          <ul className="mx-auto max-w-[640px]">
            {rest.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link href={href} aria-current={isActive(path, href) ? "page" : undefined} className={itemClass(isActive(path, href))}>
                  <Icon size={18} strokeWidth={1.7} />
                  {label}
                </Link>
              </li>
            ))}
            <li className="border-t border-line">
              <Link href="/panel" className={itemClass(false)}>
                <ArrowLeftCircle size={18} strokeWidth={1.7} />
                Ir a mi panel de cliente
              </Link>
            </li>
            <li>
              <button type="button" disabled={out} onClick={() => startOut(() => signOut())} className={`${itemClass(false)} w-full text-left`}>
                <LogOut size={18} strokeWidth={1.7} />
                {out ? "Cerrando sesión…" : "Cerrar sesión"}
              </button>
            </li>
          </ul>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-raise/95 backdrop-blur-md" aria-label="Administración">
        <ul className="mx-auto grid max-w-[640px] grid-cols-5">
          {main.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            const dot = (href === "/admin/retiros" && pending.retiros > 0) || (href === "/admin/pagos" && pending.pagos > 0);
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined} className={cell(active)}>
                  <Icon size={19} strokeWidth={1.7} />
                  {label}
                  {dot && <span role="img" className="absolute right-[24%] top-2 h-2 w-2 rounded-full bg-amber" aria-label="Hay pendientes" />}
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" aria-expanded={more} aria-controls="admin-more" onClick={() => setMore((v) => !v)} className={cell(more || inRest)}>
              <Ellipsis size={19} strokeWidth={1.5} />
              Más
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

/** En celular: la marca, el aviso de que es el admin y las salidas. */
export function AdminMobileBar() {
  const [out, startOut] = useTransition();
  const user = useUser();
  return (
    <header className="flex items-center justify-between gap-3 border-b border-line bg-raise px-4 py-3 lg:hidden">
      <Link href="/" aria-label={`${BRAND.name}, inicio`}>
        <Logo />
      </Link>
      <div className="flex items-center gap-2 text-sm text-mute sm:gap-4">
        {/* En pantallas angostas no hay barra lateral: el rol va aquí, para saber con qué permisos se entró. */}
        {user.adminRole && (
          <span className="cap hidden !text-ink sm:inline" title={user.email}>
            {ADMIN_ROLE_LABEL[user.adminRole]}
          </span>
        )}
        <Link href="/panel" className="hover:text-ink">
          Mi panel
        </Link>
        <button type="button" disabled={out} onClick={() => startOut(() => signOut())} className="hover:text-ink">
          {out ? "Saliendo…" : "Salir"}
        </button>
        <ThemeSelector />
      </div>
    </header>
  );
}

export function AdminTopbar({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pb-8">
      <div>
        <p className="cap mb-3 flex items-center gap-2 lg:hidden">
          <ShieldCheck size={13} strokeWidth={1.5} /> Administración
        </p>
        <h1 className="display text-[clamp(2rem,4.4vw,3rem)]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-[64ch] text-fog">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        {action}
        <div className="hidden lg:block">
          <ThemeSelector />
        </div>
      </div>
    </header>
  );
}

/** Se muestra si alguien con sesión, pero sin acceso, abre /admin. */
export function AdminNotAuthorized({ email }: { email: string }) {
  const [out, startOut] = useTransition();
  return (
    <div className="mx-auto mt-10 max-w-[480px] sm:mt-20">
      <p className="cap flex items-center gap-2">
        <ShieldCheck size={13} strokeWidth={1.5} /> Administración
      </p>
      <h1 className="display mt-4 text-[clamp(2.25rem,6vw,3rem)]">Sin acceso</h1>
      <p className="mt-5 leading-relaxed text-fog">
        Entraste con <strong className="font-medium text-ink">{email}</strong>, y ese correo no tiene acceso a la administración. Si debes tenerlo, pídele a un propietario que lo agregue en
        Administración › Equipo.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link href="/panel" className="btn btn-solid">
          Ir a mi panel
        </Link>
        <button type="button" disabled={out} onClick={() => startOut(() => signOut())} className="link text-sm text-fog">
          {out ? "Cerrando sesión…" : "Entrar con otra cuenta"}
        </button>
      </div>
    </div>
  );
}
