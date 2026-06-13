import { AISection } from "@/components/AISection";
import { AppsSection } from "@/components/AppsSection";
import { AudienceSection } from "@/components/AudienceSection";
import { ContactSection } from "@/components/ContactSection";
import { EngagementModels } from "@/components/EngagementModels";
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
        <AudienceSection />
        <EssenceSection />
        <ServicesSection />
        <ShopifySection />
        <AISection />
        <EngagementModels />
        <AppsSection />
        <ExperienceSection />
        <ProcessSection />
        <TechStack />
        <FinalCta />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}
