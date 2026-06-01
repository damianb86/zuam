import { ArrowRight, Sparkles } from "lucide-react";
import Image from "next/image";
import { DecorativeZ } from "@/components/DecorativeZ";

const proofPoints = ["Shopify apps", "Custom software", "Performance", "Applied AI"];

export function Hero() {
  return (
    <section id="home" className="home-section relative overflow-hidden pt-24 sm:pt-32 lg:pt-36">
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
            <span className="min-w-0 truncate">Senior software | Shopify | Applied AI</span>
          </div>

          <h1 className="text-[2.65rem] font-semibold leading-[1.03] text-ink min-[390px]:text-5xl sm:text-6xl lg:text-7xl">
            Intelligent software for businesses that sell, scale, and evolve.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-slateText sm:mt-7 sm:text-xl sm:leading-8">
            At Zuam, we build Shopify applications, custom solutions, and AI
            integrations that turn complex digital operations into clear, fast,
            and profitable systems.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row">
            <a href="#contact" className="button-primary">
              Work with us
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a href="#what-we-do" className="button-secondary">
              Explore services
              <Sparkles size={18} aria-hidden="true" />
            </a>
          </div>

          <div className="mt-8 grid max-w-2xl grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:mt-10 sm:grid-cols-4">
            {proofPoints.map((point) => (
              <div
                key={point}
                className="rounded-[8px] border border-ink/10 bg-white/70 px-4 py-3 text-sm font-semibold text-ink backdrop-blur"
              >
                {point}
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
