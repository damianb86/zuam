import { CheckCircle2 } from "lucide-react";
import { experienceClaims, metrics } from "@/data/site";
import { SectionHeading } from "@/components/SectionHeading";

export function ExperienceSection() {
  return (
    <section id="experience" aria-labelledby="experience-heading" className="section-padding">
      <div className="section-shell">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
          <SectionHeading
            id="experience-heading"
            eyebrow="Senior experience"
            title="Founder-led execution, from architecture to production."
            description="Zuam is led by a software engineer with 17+ years of experience building web products, business systems, and commerce solutions across multiple technologies and industries. Every project benefits from direct senior involvement - from technical strategy and architecture to implementation details, launch, and iteration."
          />

          <div className="grid gap-4 sm:grid-cols-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="surface-card reveal p-6 text-center">
                <p className="text-4xl font-semibold text-ink">{metric.value}</p>
                <p className="mt-2 text-sm font-medium text-slateText">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {experienceClaims.map((claim) => (
            <div
              key={claim}
              className="flex items-start gap-3 rounded-[12px] border border-ink/10 bg-white/75 px-5 py-4 text-sm font-semibold leading-6 text-ink shadow-sm"
            >
              <CheckCircle2 size={17} className="mt-1 shrink-0 text-teal" aria-hidden="true" />
              <span>{claim}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
