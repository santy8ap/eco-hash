import { Big_Shoulders } from "next/font/google";
import { BlockArt } from "@/components/landing/block-landscape";
import { FlowSection } from "@/components/landing/flow-section";
import { NetworkStrip } from "@/components/landing/network-strip";
import { PlansSection } from "@/components/landing/plans-section";
import { Closing, Faq, Footer, Hero, LandingNav } from "@/components/landing/sections";
import "@/components/landing/landing.css";

/** Big Shoulders: condensada, como los letreros pintados de una central eléctrica. Solo para los titulares de la portada. */
const shoulders = Big_Shoulders({
  variable: "--font-shoulders",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  display: "swap",
  // Next no tiene las métricas de Big Shoulders para ajustar una fuente de respaldo; el respaldo es una condensada del sistema.
  adjustFontFallback: false,
  fallback: ["Arial Narrow", "sans-serif-condensed", "sans-serif"],
});

export default function HomePage() {
  return (
    <div className={`landing ${shoulders.variable}`}>
      <LandingNav />
      <main className="pb-10">
        <Hero />
        <div className="mt-6 sm:mt-10">
          <BlockArt />
          <NetworkStrip />
        </div>
        <div className="mt-24 space-y-28 sm:mt-32 sm:space-y-36">
          <FlowSection />
          <PlansSection />
          <Faq />
          <Closing />
        </div>
      </main>
      <Footer />
    </div>
  );
}
