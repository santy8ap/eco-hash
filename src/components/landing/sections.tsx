import Link from "next/link";
import { BRAND } from "@/config/brand";
import { DEFAULT_HASHPRICE_SATS, FARM } from "@/config/farm";
import { PLANS } from "@/config/plans";
import { DAYS_PER_MONTH, GRACE_DAYS } from "@/lib/mining/plan-math";
import { isDemoMode } from "@/lib/env";
import { formatNumber, formatSats, formatTh } from "@/lib/format";
import { riverRows } from "@/lib/landscape";
import { MIN_WITHDRAWAL_SATS } from "@/lib/withdrawal-schema";
import { AccountLink } from "@/components/auth/account-link";
import { Logo } from "@/components/ui/logo";
import { ThemeSelector } from "@/components/ui/theme-selector";
import { BlockCaption } from "./block-landscape";
import { StarterCounter } from "./starter-counter";

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
          <a href="#preguntas">Preguntas</a>
          <a href="#empezar">Cómo empezar</a>
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

/**
 * El titular, la invitación y, a la derecha, el último bloque de la red. Debajo va la cordillera tejida con su hash,
 * de lado a lado de la pantalla.
 */
export function Hero() {
  return (
    <section aria-labelledby="titulo" className="mx-auto max-w-[1200px] px-4 pt-10 sm:px-8 sm:pt-14 lg:pt-16">
      <h1 id="titulo" className="shout max-w-[15ch] text-[clamp(3.4rem,8.4vw,7.4rem)]">
        Bitcoin minado con agua de río.
      </h1>
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-end">
        <div>
          <p className="max-w-[50ch] text-[1.08rem] leading-relaxed text-fog sm:text-[1.15rem]">
            Alquilas hashrate en nuestra granja de {FARM.location} y lo pagas mes a mes, en pesos. Lo que mina llega en sats a tu panel, segundo a
            segundo, y lo retiras a tu billetera Bitcoin.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#planes" className="btn btn-solid px-5">
              Ver los planes
            </a>
            <AccountLink variant="cta" />
          </div>
          <StarterCounter />
        </div>
        <BlockCaption />
      </div>
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
        <h2 id="preguntas-titulo" className="shout text-[clamp(2.8rem,6.4vw,4.8rem)] lg:sticky lg:top-28 lg:self-start">
          Preguntas frecuentes
        </h2>
        <div>
          {items.map((f) => (
            <details key={f.q} className="landing-faq group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 text-[1.08rem] font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="relative h-3.5 w-3.5 shrink-0 text-fog" aria-hidden="true">
                  <span className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 rounded bg-current" />
                  <span className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 rounded bg-current transition-transform group-open:scale-y-0" />
                </span>
              </summary>
              <p className="max-w-[66ch] pb-6 leading-relaxed text-fog">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Entra con Google", text: "Completa tus datos una sola vez: nombre, documento, celular y ciudad." },
  {
    title: "Paga el primer mes",
    text: "Con Mercado Pago (tarjeta, PSE o Nequi), transferencia bancaria o USDT. Tu hashrate empieza a minar cuando se confirma el pago.",
  },
  {
    title: "Retira tus sats",
    text: `En tu panel los sats suman cada segundo. Desde ${formatSats(MIN_WITHDRAWAL_SATS)} los envías a tu billetera Bitcoin.`,
  },
];

/** El cierre: el río vuelve a aparecer, quieto, y debajo los tres pasos para empezar. */
export function Closing() {
  const [river] = riverRows();
  return (
    <section id="empezar" aria-labelledby="empezar-titulo" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 sm:px-8">
      <p className="river-rule text-[0.8rem]" aria-hidden="true">
        {river + river}
      </p>
      <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <h2 id="empezar-titulo" className="shout text-[clamp(3.2rem,8.5vw,6.5rem)] leading-[1.04]">
            Empieza con {formatTh(PLANS[0].hashrateTh)}.
          </h2>
          <a href="#planes" className="btn btn-solid mt-8 px-5">
            Elegir un plan
          </a>
        </div>
        <ol className="grid gap-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4">
              <span className="shout text-[2.6rem] leading-none text-amber-text" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 max-w-[52ch] leading-relaxed text-fog">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
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
          <p className="mt-4 max-w-[58ch] leading-relaxed">
            Las cifras de minería son estimaciones con el hashprice vigente y el precio del BTC en vivo. Los datos de la red vienen de mempool.space y el
            precio, de Coinbase y CoinGecko.
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
