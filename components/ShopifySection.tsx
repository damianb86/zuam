import { Check, ShoppingCart } from "lucide-react";
import { shopifyCapabilities } from "@/data/site";
import { SectionHeading } from "@/components/SectionHeading";

export function ShopifySection() {
  return (
    <section id="shopify" className="section-padding border-y border-ink/10 bg-white/60">
      <div className="section-shell grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <SectionHeading
            eyebrow="Shopify"
            title="Shopify specialists for brands that need more than a store."
            description="We work on Shopify from strategy to code: apps, themes, integrations, automations, performance optimization, and continuous improvement."
          />

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {shopifyCapabilities.map((capability) => (
              <div key={capability} className="flex items-center gap-3 rounded-[8px] border border-ink/10 bg-white/80 px-4 py-3">
                <Check size={18} className="text-teal" aria-hidden="true" />
                <span className="text-sm font-semibold text-ink">{capability}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="reveal relative min-h-[520px] overflow-hidden rounded-[8px] border border-ink/10 bg-ink p-5 text-white shadow-soft">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(155,124,255,0.22),transparent_38%),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[length:auto,44px_44px]" />
          <div className="relative z-10 flex items-center justify-between rounded-[8px] border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-[8px] bg-white text-ink">
                <ShoppingCart size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">Commerce workspace</p>
                <p className="text-xs text-white/60">Products, orders, insights</p>
              </div>
            </div>
            <span className="rounded-full bg-teal/20 px-3 py-1 text-xs font-semibold text-teal">
              Live
            </span>
          </div>

          <div className="relative z-10 mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              {["Theme", "Checkout", "App layer"].map((item, index) => (
                <div key={item} className="rounded-[8px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lavender">
                    Module 0{index + 1}
                  </p>
                  <p className="mt-2 font-semibold">{item}</p>
                  <div className="mt-4 h-2 rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-lavender"
                      style={{ width: `${64 + index * 9}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[8px] border border-white/10 bg-white/10 p-4 backdrop-blur">
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="rounded-[8px] bg-white p-3 text-ink">
                    <div className="aspect-[4/3] rounded-[6px] bg-[linear-gradient(135deg,#F7F8FC,#C9BBFF)]" />
                    <div className="mt-3 h-2 w-3/4 rounded-full bg-ink/20" />
                    <div className="mt-2 h-2 w-1/2 rounded-full bg-ink/10" />
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[8px] border border-white/10 bg-ink/50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/70">Conversion path</span>
                  <span className="font-semibold text-teal">Optimized</span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="h-2 flex-1 rounded-full bg-white/20">
                      <div className="h-2 rounded-full bg-teal" style={{ width: `${55 + item * 10}%` }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <svg className="absolute bottom-8 right-8 z-0 h-56 w-56 opacity-35" viewBox="0 0 200 200" aria-hidden="true">
            <path d="M28 46 H158 L78 100 H172 L56 158" fill="none" stroke="#C9BBFF" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </section>
  );
}
