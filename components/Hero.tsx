import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import Image from "next/image";
import { DecorativeZ } from "@/components/DecorativeZ";

const proofPoints = [
  "17+ years in software engineering",
  "5+ years building with Shopify",
  "Public Shopify apps live and installable",
  "Custom apps, APIs and AI workflows"
];

export function Hero() {
  return (
    <section
      id="home"
      aria-labelledby="home-heading"
      className="home-section relative overflow-hidden pt-24 sm:pt-32 lg:pt-36"
    >
      <div className="section-shell grid items-center gap-9 pb-14 sm:gap-12 sm:pb-16 lg:grid-cols-[1fr_0.9fr] lg:pb-20">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex max-w-full items-center gap-3 rounded-full border border-ink/10 bg-white/80 px-3 py-2 text-sm font-semibold text-ink shadow-sm backdrop-blur sm:mb-7 sm:px-4">
            <span className="brand-mark-shell grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-white">
              <Image
                src="/logo.png"
                alt="Zuam logo"
                width={28}
                height={28}
                priority
                className="logo-image h-6 w-6 object-contain"
              />
            </span>
            <span className="min-w-0 truncate">
              Founder-led Shopify &amp; Applied AI Studio
            </span>
          </div>

          <h1
            id="home-heading"
            className="text-[2.65rem] font-semibold leading-[1.03] text-ink min-[390px]:text-5xl sm:text-6xl lg:text-7xl"
          >
            Custom Shopify apps and AI-powered commerce systems.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-slateText sm:mt-7 sm:text-xl sm:leading-8">
            Zuam builds custom Shopify apps, Shopify integrations, AI-powered
            commerce workflows, and custom web systems for merchants, Shopify
            Plus stores, and agencies that need senior technical execution
            beyond off-the-shelf software.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row">
            <a href="#contact" className="button-primary">
              Discuss a project
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a href="#shopify" className="button-secondary">
              Explore Shopify expertise
              <Sparkles size={18} aria-hidden="true" />
            </a>
          </div>

          <div className="mt-8 grid max-w-2xl grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:mt-10 sm:grid-cols-4">
            {proofPoints.map((point) => (
              <div
                key={point}
                className="flex min-h-[76px] items-start gap-3 rounded-[12px] border border-ink/10 bg-white/80 px-4 py-3 text-sm font-semibold leading-5 text-ink shadow-sm backdrop-blur"
              >
                <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="reveal lg:pl-4">
          <DecorativeZ />
        </div>
      </div>
    </section>
  );
}
