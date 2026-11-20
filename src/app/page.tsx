import { FarmSection } from "@/components/landing/farm-section";
import { NetworkStrip } from "@/components/landing/network-strip";
import { PlansSection } from "@/components/landing/plans-section";
import { Faq, FinalCta, Footer, Hero, HowItWorks, LandingNav } from "@/components/landing/sections";
import "@/components/landing/landing.css";

export default function HomePage() {
  return (
    <>
      <LandingNav />
      <main className="space-y-20 pb-10 sm:space-y-28">
        <div className="space-y-6">
          <Hero />
          <NetworkStrip />
        </div>
        <FarmSection />
        <PlansSection />
        <HowItWorks />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
