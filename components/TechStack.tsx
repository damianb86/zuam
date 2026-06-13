import { technologyGroups } from "@/data/site";
import { SectionHeading } from "@/components/SectionHeading";

export function TechStack() {
  return (
    <section
      id="technologies"
      aria-labelledby="technologies-heading"
      className="section-padding border-y border-ink/10 bg-white/60"
    >
      <div className="section-shell">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <SectionHeading
            id="technologies-heading"
            eyebrow="Technologies"
            title="Technology chosen for the problem, not the trend."
            description="Zuam works across modern web, commerce, backend, and AI technologies, choosing the stack that best fits the product, platform, and long-term maintenance needs."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            {technologyGroups.map((group) => (
              <article
                key={group.title}
                className="reveal rounded-[16px] border border-ink/10 bg-white/80 p-5 shadow-sm"
              >
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-violet">
                  {group.title}
                </h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className="max-w-full break-words rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs font-semibold leading-5 text-ink"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
