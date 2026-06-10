import { technologies } from "@/data/site";
import { SectionHeading } from "@/components/SectionHeading";

export function TechStack() {
  return (
    <section id="technologies" className="section-padding border-y border-ink/10 bg-white/60">
      <div className="section-shell">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <SectionHeading
            eyebrow="Technologies"
            title="Technologies we build with"
            description="We choose modern, stable, and scalable tools based on the problem, not on hype."
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {technologies.map((technology) => (
              <div
                key={technology}
                className="reveal rounded-[10px] border border-ink/10 bg-white/80 px-4 py-4 text-sm font-semibold text-ink shadow-sm transition hover:-translate-y-1 hover:border-violet/40 hover:shadow-soft"
              >
                {technology}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
