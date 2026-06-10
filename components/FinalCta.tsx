import { ArrowRight } from "lucide-react";

export function FinalCta() {
  return (
    <section className="pb-20 sm:pb-24 lg:pb-28">
      <div className="section-shell">
        <div className="rounded-[24px] border border-ink/10 bg-white p-6 shadow-soft sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="max-w-3xl text-3xl font-semibold leading-tight text-ink sm:text-4xl">
                Let&apos;s turn an idea, a store, or a process into a better system.
              </h2>
              <p className="mt-4 max-w-2xl leading-7 text-slateText">
                We can help you build an app, optimize Shopify, integrate AI, or
                design a custom solution for your business.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <a href="#contact" className="button-primary">
                Contact
                <ArrowRight size={18} aria-hidden="true" />
              </a>
              <a href="#what-we-do" className="button-secondary">
                View services
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
