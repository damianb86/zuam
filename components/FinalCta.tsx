import { ArrowRight } from "lucide-react";

export function FinalCta() {
  return (
    <section aria-labelledby="final-cta-heading" className="pb-20 sm:pb-24 lg:pb-28">
      <div className="section-shell">
        <div className="rounded-[24px] border border-ink/10 bg-white p-6 shadow-soft sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2
                id="final-cta-heading"
                className="max-w-3xl text-3xl font-semibold leading-tight text-ink sm:text-4xl"
              >
                Let&apos;s build the Shopify or AI system your business actually needs.
              </h2>
              <p className="mt-4 max-w-2xl leading-7 text-slateText">
                Whether you need a custom Shopify app, an AI-powered commerce
                workflow, a complex integration, or senior technical execution
                for your ecommerce stack, Zuam can help you move from idea to
                production with clarity and depth.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <a href="#contact" className="button-primary">
                Start a technical conversation
                <ArrowRight size={18} aria-hidden="true" />
              </a>
              <a href="#apps" className="button-secondary">
                View Shopify apps
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
