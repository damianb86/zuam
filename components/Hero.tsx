import { ArrowRight, Sparkles } from "lucide-react";
import Image from "next/image";
import { DecorativeZ } from "@/components/DecorativeZ";

const proofPoints = ["Shopify apps", "Custom software", "Performance", "Applied AI"];

export function Hero() {
  return (
    <section id="home" className="home-section relative overflow-hidden pt-28 sm:pt-32 lg:pt-36">
      <div className="section-shell grid items-center gap-12 pb-16 lg:grid-cols-[1fr_0.9fr] lg:pb-20">
        <div className="max-w-3xl">
          <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-ink/10 bg-white/80 px-4 py-2 text-sm font-semibold text-ink shadow-sm backdrop-blur">
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
            <span>Senior software | Shopify | Applied AI</span>
          </div>

          <h1 className="text-5xl font-semibold leading-[1.02] text-ink sm:text-6xl lg:text-7xl">
            Intelligent software for businesses that sell, scale, and evolve.
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-slateText sm:text-xl">
            At Zuam, we build Shopify applications, custom solutions, and AI
            integrations that turn complex digital operations into clear, fast,
            and profitable systems.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a href="#contact" className="button-primary">
              Work with us
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a href="#what-we-do" className="button-secondary">
              Explore services
              <Sparkles size={18} aria-hidden="true" />
            </a>
          </div>

          <div className="mt-10 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
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
