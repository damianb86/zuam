import {
  BadgeCheck,
  BrainCircuit,
  ClipboardCheck,
  Handshake,
  LifeBuoy,
  ShoppingBag,
  Workflow
} from "lucide-react";
import {
  engagementModels,
  type EngagementIcon
} from "@/data/site";
import { SectionHeading } from "@/components/SectionHeading";

const iconMap: Record<EngagementIcon, typeof ShoppingBag> = {
  privateApp: ShoppingBag,
  publicApp: BadgeCheck,
  partner: Handshake,
  aiSprint: BrainCircuit,
  workflow: Workflow,
  support: LifeBuoy,
  audit: ClipboardCheck
};

export function EngagementModels() {
  return (
    <section
      id="engagement"
      aria-labelledby="engagement-heading"
      className="section-padding border-y border-ink/10 bg-white/60"
    >
      <div className="section-shell">
        <SectionHeading
          id="engagement-heading"
          eyebrow="Engagement models"
          title="Flexible ways to work with senior technical execution."
          description="Zuam is best suited for meaningful technical work: focused custom builds, complex integrations, AI-powered workflows, and ongoing Shopify engineering support."
          align="center"
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {engagementModels.map((model) => {
            const Icon = iconMap[model.icon];

            return (
              <article key={model.title} className="surface-card reveal flex h-full flex-col p-7">
                <div className="icon-box mb-6 teal">
                  <Icon size={22} aria-hidden="true" />
                </div>
                <h3 className="text-xl font-semibold text-ink">{model.title}</h3>
                <p className="mt-3 flex-1 leading-7 text-slateText">
                  {model.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
