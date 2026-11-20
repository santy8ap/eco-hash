import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BRAND } from "@/config/brand";
import { AccountLink } from "@/components/auth/account-link";
import { Logo } from "@/components/ui/logo";
import { ThemeSelector } from "@/components/ui/theme-selector";
import { SupportContacts } from "@/components/support/support-contacts";

export const metadata: Metadata = {
  title: "Centro de ayuda",
  description: "Ayuda con planes de hashrate, pagos, mensualidades y retiros en BTC.",
};

async function Contacts({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  return (
    <SupportContacts
      reference={ref && /^[A-Za-z0-9-]{1,80}$/.test(ref) ? ref : undefined}
    />
  );
}

export default function HelpPage({ searchParams }: PageProps<"/ayuda">) {
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex h-[72px] max-w-[1100px] items-center justify-between px-4 sm:px-8">
          <Link href="/" aria-label={`${BRAND.name}, inicio`}>
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <AccountLink />
            <ThemeSelector />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1100px] px-4 pb-24 pt-12 sm:px-8 sm:pt-16">
        <h1 className="display max-w-[18ch] text-[clamp(2.4rem,6vw,3.6rem)]">
          ¿En qué te ayudamos?
        </h1>
        <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-fog">
          Consulta el estado de tu compra y encuentra los pasos para resolver
          dudas sobre pagos, planes y retiros en BTC.
        </p>
        <Suspense fallback={<div className="skeleton mt-10 h-24" />}>
          <Contacts searchParams={searchParams as Promise<{ ref?: string }>} />
        </Suspense>
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {[
            [
              "Mi pago sigue pendiente",
              "Algunos medios tardan en confirmar el resultado. Abre tus movimientos y consulta el pago con su referencia. Evita repetirlo mientras se confirma.",
              "/panel/billetera",
              "Consultar movimientos",
            ],
            [
              "Quiero pagar la próxima mensualidad",
              "En tus planes encontrarás el mes disponible y el valor contratado. Pagar antes del vencimiento permite continuar sin pausa.",
              "/panel/planes",
              "Ver mis planes",
            ],
            [
              "Pedí un retiro y no me ha llegado",
              "Cada retiro lo revisa el equipo antes de enviarlo. Cuando sale, verás el txid en tus movimientos y podrás seguirlo en mempool.space hasta que la red lo confirme.",
              "/panel/billetera",
              "Ver mis retiros",
            ],
            [
              "Necesito mi comprobante",
              "Puedes descargar el PDF de un pago o retiro confirmado desde el historial de movimientos.",
              "/panel/billetera",
              "Buscar comprobante",
            ],
            [
              "Necesito actualizar mis datos",
              "Actualiza tu nombre, documento, celular o ciudad desde tu perfil de cliente.",
              "/panel/perfil",
              "Revisar mis datos",
            ],
          ].map(([title, detail, href, action]) => (
            <section key={title} className="panel p-6">
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-3 leading-relaxed text-fog">{detail}</p>
              <Link href={href} className="link mt-5 inline-block text-sm">
                {action}
              </Link>
            </section>
          ))}
        </div>
        <p className="mt-8 border-t border-line pt-7 text-sm text-mute">
          También puedes consultar los{" "}
          <Link href="/terminos" className="link">
            Términos y Condiciones
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" className="link">
            Política de Datos
          </Link>
          .
        </p>
      </main>
    </>
  );
}
