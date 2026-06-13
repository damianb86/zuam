import { ArrowRight, Check } from "lucide-react";
import { shopifyCapabilityGroups } from "@/data/site";
import { SectionHeading } from "@/components/SectionHeading";

export function ShopifySection() {
  return (
    <section
      id="shopify"
      aria-labelledby="shopify-heading"
      className="section-padding border-y border-ink/10 bg-white/60"
    >
      <div className="section-shell">
        <SectionHeading
          id="shopify-heading"
          eyebrow="Shopify Engineering"
          title="Shopify development for stores that need deeper platform work."
          description="Zuam builds beyond standard theme customization. We work across Shopify's app, admin, storefront, and checkout layers to create systems that fit specific business rules, operational workflows, and customer experiences."
          align="center"
        />

        <p className="mx-auto mt-6 max-w-3xl text-center text-base leading-7 text-slateText sm:text-lg">
          From focused store-specific tools to public Shopify apps, Zuam builds
          with platform constraints, review requirements, and long-term
          maintenance in mind. Zuam also works with Shopify and ecommerce
          agencies that need senior technical execution behind the scenes.
        </p>

        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          {shopifyCapabilityGroups.map((group, index) => (
            <article key={group.title} className="surface-card reveal flex h-full flex-col p-7">
              <div className="mb-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-violet">
                  Capability 0{index + 1}
                </p>
                <h3 className="text-2xl font-semibold leading-tight text-ink">{group.title}</h3>
                <p className="mt-3 leading-7 text-slateText">{group.description}</p>
              </div>

              <div className="mt-auto grid gap-2.5 sm:grid-cols-2">
                {group.items.map((item) => (
                  <div
                    key={item}
                    className="flex min-w-0 items-start gap-3 rounded-[10px] border border-ink/10 bg-white/80 px-3.5 py-3"
                  >
                    <Check size={17} className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
                    <span className="min-w-0 break-words text-sm font-semibold leading-5 text-ink">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="reveal mt-12 overflow-hidden rounded-[24px] bg-ink text-white shadow-soft">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h3 className="text-2xl font-semibold">
                Need something Shopify does not support out of the box?
              </h3>
              <p className="mt-3 max-w-3xl leading-7 text-white/70">
                Let&apos;s design the right app, extension, or integration for
                the workflow, plan constraints, and operational reality behind
                the store.
              </p>
            </div>
            <a href="#contact" className="button-primary bg-white text-ink hover:bg-lavender">
              Discuss a Shopify project
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
