import Image from "next/image";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
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
    <section id="apps" aria-labelledby="apps-heading" className="section-padding">
      <div className="section-shell">
        <SectionHeading
          id="apps-heading"
          eyebrow="Shopify Apps by Zuam"
          title="Public Shopify apps built from real merchant problems."
          description="Zuam builds installable Shopify apps designed to solve specific merchant workflows - from personalization and redirects to AI-assisted operations and product quality analysis."
          align="center"
        />

        <div className="mx-auto mt-8 max-w-4xl rounded-[16px] border border-ink/10 bg-white/75 px-5 py-4 text-center shadow-sm">
          <p className="text-sm font-semibold leading-6 text-ink">
            These apps are public, installable Shopify products - built not
            only as standalone tools, but also as proof of Zuam&apos;s ability
            to design, ship, and maintain real Shopify software.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-6xl gap-5 sm:grid-cols-2">
          {apps.map((app) => (
            <article key={app.name} className="surface-card reveal flex h-full flex-col overflow-hidden p-0">
              <div className="flex items-start gap-5 border-b border-ink/10 bg-white/70 p-5 sm:p-6">
                <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-[18px] bg-white text-lg font-semibold text-ink shadow-sm sm:h-24 sm:w-24 sm:rounded-[22px]">
                  {app.icon ? (
                    <Image src={app.icon} alt={`${app.name} icon`} width={96} height={96} className="h-full w-full object-contain" />
                  ) : (
                    getInitials(app.name)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-3 inline-flex rounded-full border border-teal/20 bg-teal/10 px-3 py-1 text-xs font-semibold text-ink">
                    Public Shopify app
                  </div>
                  <h3 className="text-2xl font-semibold leading-tight text-ink">{app.name}</h3>
                </div>
              </div>

              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <p className="leading-7 text-slateText">{app.description}</p>

                {app.useCases.length ? (
                  <div className="mt-6 space-y-2">
                    {app.useCases.map((useCase) => (
                      <div key={useCase} className="flex items-start gap-2 text-sm font-medium leading-6 text-ink">
                        <Check size={16} className="mt-1 shrink-0 text-teal" aria-hidden="true" />
                        <span>{useCase}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-2">
                  {app.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold text-slateText">
                      {tag}
                    </span>
                  ))}
                </div>

                <a
                  href={app.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-auto inline-flex w-fit items-center gap-2 pt-8 text-sm font-semibold text-ink transition hover:text-violet focus:outline-none focus:ring-2 focus:ring-violet focus:ring-offset-2"
                  aria-label={`View ${app.name} on the Shopify App Store`}
                >
                  View Shopify app
                  <ArrowUpRight size={17} aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
        </div>

        <div className="reveal mx-auto mt-12 max-w-5xl rounded-[24px] border border-ink/10 bg-ink p-6 text-white shadow-soft sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h3 className="text-2xl font-semibold">
                Need a custom Shopify app for your store?
              </h3>
              <p className="mt-3 max-w-3xl leading-7 text-white/70">
                Zuam can design and build store-specific apps, public apps, and
                Shopify workflow tools around your business rules, data, and
                operational needs.
              </p>
            </div>
            <a href="#contact" className="button-primary bg-white text-ink hover:bg-lavender">
              Discuss a custom app
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
