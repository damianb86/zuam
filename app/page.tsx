import { AISection } from "@/components/AISection";
import { AppsSection } from "@/components/AppsSection";
import { ContactSection } from "@/components/ContactSection";
import { EssenceSection } from "@/components/EssenceSection";
import { ExperienceSection } from "@/components/ExperienceSection";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Navbar } from "@/components/Navbar";
import { ProcessSection } from "@/components/ProcessSection";
import { ServicesSection } from "@/components/ServicesSection";
import { ShopifySection } from "@/components/ShopifySection";
import { TechStack } from "@/components/TechStack";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <EssenceSection />
        <ServicesSection />
        <ShopifySection />
        <AppsSection />
        <TechStack />
        <ExperienceSection />
        <ProcessSection />
        <AISection />
        <FinalCta />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}
