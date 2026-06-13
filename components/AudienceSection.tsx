import {
  BadgeCheck,
  BriefcaseBusiness,
  Handshake,
  Store
} from "lucide-react";
import {
  audienceSegments,
  type AudienceIcon
} from "@/data/site";
import { SectionHeading } from "@/components/SectionHeading";

const iconMap: Record<AudienceIcon, typeof Store> = {
  merchant: Store,
  plus: BadgeCheck,
  agency: Handshake,
  business: BriefcaseBusiness
};

export function AudienceSection() {
  return (
    <section
      id="who-we-help"
      aria-labelledby="who-we-help-heading"
      className="section-padding border-y border-ink/10 bg-white/60"
    >
      <div className="section-shell">
        <SectionHeading
          id="who-we-help-heading"
          eyebrow="Who we help"
          title="Built for serious Shopify and commerce teams."
          description="Zuam works with merchants, Shopify Plus stores, ecommerce brands and agencies that need reliable custom development, deeper platform work or AI-powered workflows inside their commerce stack."
          align="center"
        />

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {audienceSegments.map((segment) => {
            const Icon = iconMap[segment.icon];

            return (
              <article key={segment.title} className="surface-card reveal flex h-full flex-col p-7">
                <div className="icon-box mb-6">
                  <Icon size={22} aria-hidden="true" />
                </div>
                <h3 className="text-xl font-semibold text-ink">{segment.title}</h3>
                <p className="mt-3 flex-1 leading-7 text-slateText">
                  {segment.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
