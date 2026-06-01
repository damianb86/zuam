import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { apps } from "@/data/site";
import { SectionHeading } from "@/components/SectionHeading";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AppsSection() {
  return (
    <section id="apps" className="section-padding">
      <div className="section-shell">
        <SectionHeading
          eyebrow="Our apps"
          title="Shopify apps in the Zuam ecosystem."
          description="These products are structured in editable data files so descriptions, icons, statuses, and Shopify App Store URLs can evolve as each app becomes available."
          align="center"
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {apps.map((app) => (
            <article key={app.name} className="surface-card reveal flex h-full flex-col p-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-[8px] border border-ink/10 bg-[linear-gradient(135deg,#071226,#9B7CFF)] text-lg font-semibold text-white">
                  {app.icon ? (
                    <Image src={app.icon} alt={`${app.name} icon`} width={64} height={64} className="h-full w-full object-cover" />
                  ) : (
                    getInitials(app.name)
                  )}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {app.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold text-slateText">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <h3 className="text-2xl font-semibold text-ink">{app.name}</h3>
              <p className="mt-3 flex-1 leading-7 text-slateText">{app.description}</p>

              {app.url ? (
                <a
                  href={app.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-ink transition hover:text-violet focus:outline-none focus:ring-2 focus:ring-violet focus:ring-offset-2"
                >
                  View on Shopify App Store
                  <ArrowUpRight size={17} aria-hidden="true" />
                </a>
              ) : (
                <p className="mt-8 text-sm font-semibold text-slateText">
                  Shopify App Store URL pending
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
