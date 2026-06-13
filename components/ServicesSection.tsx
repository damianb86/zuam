import { services } from "@/data/site";
import { SectionHeading } from "@/components/SectionHeading";
import { ServiceCard } from "@/components/ServiceCard";

export function ServicesSection() {
  return (
    <section id="what-we-build" aria-labelledby="what-we-build-heading" className="section-padding">
      <div className="section-shell">
        <SectionHeading
          id="what-we-build-heading"
          eyebrow="What we build"
          title="Custom software for Shopify, commerce operations and AI-powered workflows."
          description="Zuam helps businesses design and build the technical layer that standard themes, apps, and tools cannot fully solve."
          align="center"
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <ServiceCard key={service.title} service={service} />
          ))}
        </div>
      </div>
    </section>
  );
}
