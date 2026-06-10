import { experienceClaims, metrics } from "@/data/site";
import { SectionHeading } from "@/components/SectionHeading";

export function ExperienceSection() {
  return (
    <section className="section-padding">
      <div className="section-shell">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
          <SectionHeading
            eyebrow="Senior experience"
            title="A senior team for building with judgment."
            description="We have years of experience developing digital products and working across multiple clients, technologies, and business contexts. We get involved from architecture to implementation detail."
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
            <div key={claim} className="rounded-[10px] border border-ink/10 bg-white/75 px-5 py-4 text-sm font-semibold text-ink shadow-sm">
              {claim}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
