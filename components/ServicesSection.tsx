import { services } from "@/data/site";
import { SectionHeading } from "@/components/SectionHeading";
import { ServiceCard } from "@/components/ServiceCard";

export function ServicesSection() {
  return (
    <section id="what-we-do" className="section-padding">
      <div className="section-shell">
        <SectionHeading
          eyebrow="What we do"
          title="Senior execution across Shopify, software, performance, and AI."
          description="We build the pieces that make digital commerce easier to run, easier to measure, and easier to grow."
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
