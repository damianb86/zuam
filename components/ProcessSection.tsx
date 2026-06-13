import { processSteps } from "@/data/site";
import { SectionHeading } from "@/components/SectionHeading";

export function ProcessSection() {
  return (
    <section
      id="process"
      aria-labelledby="process-heading"
      className="section-padding border-y border-ink/10 bg-white/60"
    >
      <div className="section-shell">
        <SectionHeading
          id="process-heading"
          eyebrow="Process"
          title="A clear path from business problem to working system."
          description="Our process keeps strategy, architecture, implementation, and measurement connected from the start."
          align="center"
        />

        <div className="relative mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
          <div className="absolute left-0 right-0 top-8 hidden h-px bg-ink/20 lg:block" />
          {processSteps.map((step, index) => (
            <article key={step.title} className="surface-card reveal relative p-6">
              <div className="mb-5 flex items-center gap-4">
                <span className="relative z-10 grid h-16 w-16 place-items-center rounded-full border border-white bg-ink text-lg font-semibold text-white shadow-soft">
                  0{index + 1}
                </span>
                <span className="h-px flex-1 bg-ink/10 lg:hidden" />
              </div>
              <h3 className="text-xl font-semibold leading-snug text-ink">{step.title}</h3>
              <p className="mt-3 leading-7 text-slateText">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
