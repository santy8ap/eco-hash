import Link from "next/link";
import { BRAND } from "@/config/brand";
import { DEFAULT_HASHPRICE_SATS, FARM } from "@/config/farm";
import { PLANS, PLAN_MONTHS } from "@/config/plans";
import { DAYS_PER_MONTH, GRACE_DAYS } from "@/lib/mining/plan-math";
import { isDemoMode } from "@/lib/env";
import { formatNumber, formatSats } from "@/lib/format";
import { MIN_WITHDRAWAL_SATS } from "@/lib/withdrawal-schema";
import { AccountLink } from "@/components/auth/account-link";
import { Logo } from "@/components/ui/logo";
import { ThemeSelector } from "@/components/ui/theme-selector";
import { BlockReadout } from "./block-readout";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-void/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-4 sm:h-[72px] sm:px-8">
        <Link href="/" className="inline-flex shrink-0 items-center" aria-label={`${BRAND.name}, inicio`}>
          <Logo size="header" />
        </Link>
        <nav className="landing-nav ml-6 hidden flex-1 items-center gap-1 text-[0.95rem] text-fog lg:flex" aria-label="Secciones">
          <a href="#granja">La granja</a>
          <a href="#planes">Planes</a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#preguntas">Preguntas</a>
          <Link href="/ayuda">Ayuda</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <AccountLink />
          <ThemeSelector />
        </div>
      </div>
    </header>
  );
}

export function Hero() {
  const [smallest, biggest] = [PLANS[0], PLANS.at(-1)!];
  return (
    <section className="landing-hero mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] items-center gap-10 px-4 pb-14 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:gap-14 lg:pb-20 lg:pt-20">
      <div className="min-w-0">
        <h1 className="display text-[clamp(2.6rem,6.4vw,4.6rem)]">Mina Bitcoin sin comprar una sola máquina.</h1>
        <p className="mt-6 max-w-[50ch] text-[1.08rem] leading-relaxed text-fog sm:text-[1.15rem]">
          Contrata hashrate en nuestra granja hidroeléctrica de {FARM.location}. Pagas cada mes en pesos y tus sats se acumulan día y noche en tu
          panel.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#planes" className="btn btn-solid px-5">
            Ver los planes
          </a>
          <AccountLink variant="cta" />
        </div>
        <p className="mt-6 text-sm text-mute">
          De {formatNumber(smallest.hashrateTh)} a {formatNumber(biggest.hashrateTh)} TH/s, contratos de {PLAN_MONTHS} meses y retiros en BTC a tu billetera.
        </p>
      </div>
      <BlockReadout />
    </section>
  );
}

const STEPS = [
  {
    title: "Crea tu cuenta",
    text: "Entra con Google y completa tus datos: nombre, documento, celular y ciudad. Los pedimos una sola vez, antes del primer pago.",
  },
  {
    title: "Elige un plan y paga el primer mes",
    text: "Paga con Mercado Pago (tarjeta, PSE o Nequi), transferencia bancaria o USDT. Tu hashrate empieza a minar cuando se confirma el pago.",
  },
  {
    title: "Mira tus sats y retíralos",
    text: `En tu panel los sats suben cada segundo. Desde ${formatSats(MIN_WITHDRAWAL_SATS)} los puedes enviar a tu billetera Bitcoin.`,
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" aria-labelledby="como-titulo" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 sm:px-8">
      <h2 id="como-titulo" className="display text-[clamp(2.1rem,4.6vw,3.25rem)]">
        Cómo funciona
      </h2>
      <ol className="mt-10 grid gap-3 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="panel p-6">
            <span className="figure flex h-10 w-10 items-center justify-center rounded-[10px] bg-amber-soft text-lg text-amber-text" aria-hidden="true">
              {i + 1}
            </span>
            <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 leading-relaxed text-fog">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const FAQ = [
  {
    q: "¿Qué es un TH/s?",
    a: "Un terahash por segundo: un billón de intentos por segundo de encontrar un bloque válido. Es la medida del trabajo de un minero. Cuantos más TH/s contratas, más sats te corresponden de lo que mina la granja.",
  },
  {
    q: "¿Cuántos sats voy a minar?",
    a: `Tus TH/s por el hashprice del mes por los días. Con ${formatNumber(PLANS[0].hashrateTh)} TH/s y un hashprice de ${DEFAULT_HASHPRICE_SATS} sats por TH/s al día son ${formatSats(PLANS[0].hashrateTh * DEFAULT_HASHPRICE_SATS)} al día. El contador de tu panel suma cada segundo.`,
  },
  {
    q: "¿Por qué el hashprice cambia de un mes a otro?",
    a: "Depende de la dificultad de la red, que se ajusta cada 2.016 bloques, y de las comisiones de las transacciones. Por eso cada mes que pagas mina con el hashprice vigente el día en que se confirma el pago, y ese valor no cambia durante el mes.",
  },
  {
    q: "¿Cómo se paga?",
    a: `Mes a mes, en pesos. Cada pago confirmado cubre ${DAYS_PER_MONTH} días de minería. Si pagas por adelantado, el mes nuevo empieza al terminar el anterior. Si un mes vence sin pagar, la minería se pausa y tienes ${GRACE_DAYS} días para retomarla antes de que el plan se cierre.`,
  },
  {
    q: "¿Cómo retiro mis sats?",
    a: `Desde tu billetera en el panel, a una dirección Bitcoin tuya (empieza por bc1, 1 o 3), desde ${formatSats(MIN_WITHDRAWAL_SATS)}. El equipo revisa la solicitud, envía los BTC y te comparte el txid para que sigas la transacción.`,
  },
  {
    q: "¿La rentabilidad está garantizada?",
    a: "No. Los sats dependen del hashprice y su valor en pesos del precio del BTC, que sube y baja. En los planes ves una estimación con los valores de hoy, nunca una promesa.",
  },
];

const FAQ_TEST: (typeof FAQ)[number] = {
  q: "¿Cómo hago un pago de prueba?",
  a: "La página está en modo de pruebas: en la compra, elige «Pago de prueba» para activar un mes sin dinero real y ver cómo minan tus sats.",
};

export function Faq() {
  const items = isDemoMode() ? [...FAQ, FAQ_TEST] : FAQ;
  return (
    <section id="preguntas" aria-labelledby="preguntas-titulo" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 sm:px-8">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)] lg:gap-16">
        <h2 id="preguntas-titulo" className="display text-[clamp(2.1rem,4.6vw,3.25rem)]">
          Preguntas frecuentes
        </h2>
        <div className="grid gap-2">
          {items.map((f) => (
            <details key={f.q} className="landing-faq group panel px-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-[1.05rem] font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="relative h-3.5 w-3.5 shrink-0 text-amber-text" aria-hidden="true">
                  <span className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 rounded bg-current" />
                  <span className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 rounded bg-current transition-transform group-open:scale-y-0" />
                </span>
              </summary>
              <p className="max-w-[68ch] pb-5 leading-relaxed text-fog">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 sm:px-8">
      <div className="final-cta panel relative overflow-hidden px-6 py-10 sm:px-10 sm:py-14">
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="display max-w-[18ch] text-[clamp(2rem,4.4vw,3rem)]">Empieza con {formatNumber(PLANS[0].hashrateTh)} TH/s.</h2>
            <p className="mt-3 max-w-[48ch] leading-relaxed text-fog">Paga el primer mes y mira cómo suben tus sats desde el primer segundo.</p>
          </div>
          <a href="#planes" className="btn btn-solid px-5">
            Elegir un plan
          </a>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto max-w-[1200px] px-4 pb-12 pt-6 sm:px-8">
      <div className="flex flex-col gap-8 border-t border-line pt-8 text-sm text-mute md:flex-row md:items-start md:justify-between">
        <div>
          <Logo />
          <p className="mt-4 max-w-[54ch] leading-relaxed">
            Las cifras de minería son estimaciones con el hashprice vigente y el precio del BTC del día. Los datos de la red vienen de mempool.space.
          </p>
        </div>
        <nav className="flex flex-col gap-2 md:items-end" aria-label="Legal">
          <Link href="/terminos" className="hover:text-ink">
            Términos y condiciones
          </Link>
          <Link href="/privacidad" className="hover:text-ink">
            Política de tratamiento de datos
          </Link>
          <Link href="/ayuda" className="hover:text-ink">
            Centro de ayuda
          </Link>
          <span className="text-dim">Hecho en {BRAND.country}</span>
        </nav>
      </div>
    </footer>
  );
}
