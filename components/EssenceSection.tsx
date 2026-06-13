import { pillars } from "@/data/site";
import { SectionHeading } from "@/components/SectionHeading";

export function EssenceSection() {
  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="section-padding border-y border-ink/10 bg-white/60"
    >
      <div className="section-shell">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <SectionHeading
            id="about-heading"
            eyebrow="What is Zuam"
            title="A boutique technical studio for Shopify, AI and custom software."
            description="Zuam is a founder-led boutique technical studio building custom Shopify apps, Shopify integrations, AI-powered commerce workflows, and custom web systems for merchants, Shopify Plus stores, and agencies. We combine senior engineering with product judgment, helping teams turn platform limitations, manual processes, and disconnected tools into reliable software."
          />

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {pillars.map((pillar, index) => (
              <article key={pillar.title} className="surface-card reveal p-6">
                <div className="mb-5 flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-sand text-sm font-semibold text-ink">
                    0{index + 1}
                  </span>
                  <h3 className="text-xl font-semibold text-ink">{pillar.title}</h3>
                </div>
                <p className="leading-7 text-slateText">{pillar.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
