import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BRAND } from "@/config/brand";
import { PLANS } from "@/config/plans";
import { planCheckoutHref, safeReturnTo } from "@/lib/navigation";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { adminEmailAllowed, env, googleEnabled, isDemoMode } from "@/lib/env";
import { BlockReadout } from "@/components/landing/block-readout";
import "@/components/landing/landing.css";
import { Logo } from "@/components/ui/logo";
import { ThemeSelector } from "@/components/ui/theme-selector";
import { LoginOptions } from "./login-options";

export const metadata: Metadata = { title: "Ingresar" };

type Params = { rol?: string; plan?: string; next?: string };

async function Options({ searchParams }: { searchParams: Promise<Params> }) {
  // Se lee al momento de la visita: si agregas las credenciales de Google no hace falta recompilar.
  await connection();
  const { rol, plan, next } = await searchParams;
  const requested = safeReturnTo(next);
  const planId =
    plan ??
    (requested
      ? new URL(requested, "https://internal.invalid").searchParams.get("plan")
      : null);
  const chosen = PLANS.find((p) => p.id === planId);
  const returnTo =
    requested ?? (chosen ? planCheckoutHref(chosen.id) : "/panel");
  if (rol !== "admin" && (await getSessionUser())) redirect(returnTo);
  return (
    <>
      {chosen && (
        <p className="tile mb-7 px-4 py-3 text-sm leading-relaxed text-fog">
          Elegiste el plan <strong className="font-medium text-ink">{chosen.name}</strong> ({chosen.hashrateTh} TH/s). Entra, completa tus datos
          personales y paga el primer mes.
        </p>
      )}
      <LoginOptions
        googleEnabled={googleEnabled}
        demoMode={isDemoMode()}
        testAdmin={isDemoMode() && adminEmailAllowed(env.demoEmail)}
        defaultRole={rol === "admin" ? "admin" : "user"}
        planId={chosen?.id}
        returnTo={returnTo}
      />
      {isDemoMode() && (
        <p className="mt-7 text-xs leading-relaxed text-mute">
          La cuenta de pruebas está habilitada. Al comprar, elige «Pago de prueba» para activar un mes sin dinero real.
        </p>
      )}
    </>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/ingresar">) {
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="mx-auto flex h-[72px] w-full max-w-[1200px] items-center justify-between px-4 sm:px-8">
        <Link href="/" aria-label={`${BRAND.name}, inicio`}>
          <Logo size="header" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/" className="link text-right text-sm text-fog">
            Volver al inicio
          </Link>
          <ThemeSelector />
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-[1200px] flex-1 grid-cols-[minmax(0,1fr)] items-center gap-16 px-4 pb-16 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <BlockReadout />
          <p className="mt-8 max-w-[46ch] leading-relaxed text-mute">
            Entra para ver cómo minan tus planes, pagar el mes siguiente y enviar tus sats a tu billetera.
          </p>
        </div>
        <div className="mx-auto w-full max-w-[440px]">
          <h1 className="display text-[clamp(2.4rem,6vw,3.4rem)]">Ingresar</h1>
          <div className="mt-10">
            <Suspense fallback={<div className="skeleton h-[280px]" />}>
              <Options searchParams={searchParams as Promise<Params>} />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
