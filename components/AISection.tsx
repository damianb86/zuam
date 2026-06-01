import { aiExamples } from "@/data/site";
import { SectionHeading } from "@/components/SectionHeading";

export function AISection() {
  return (
    <section className="section-padding">
      <div className="section-shell">
        <div className="overflow-hidden rounded-[8px] bg-ink text-white shadow-soft">
          <div className="grid gap-10 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:p-12">
            <div>
              <SectionHeading
                eyebrow="AI first"
                title="Applied AI where the business needs it."
                description="We do not add artificial intelligence as decoration. We use it to create faster systems: automate tasks, analyze information, support decisions, improve experiences, and free operational time."
                tone="dark"
              />
            </div>

            <div className="relative min-h-[420px] overflow-hidden rounded-[8px] border border-white/10 bg-white/10 p-5">
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[length:42px_42px]" />
              <svg className="absolute inset-0 h-full w-full opacity-80" viewBox="0 0 620 420" aria-hidden="true">
                <path d="M82 90 H322 L198 204 H462 L292 330" fill="none" stroke="#9B7CFF" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M110 126 C220 80 300 170 392 112 C470 62 520 104 556 144" fill="none" stroke="#26B8A6" strokeWidth="2" strokeDasharray="8 10" />
                <path d="M118 308 C224 254 316 340 414 260 C480 206 528 242 570 286" fill="none" stroke="#C9BBFF" strokeWidth="2" strokeDasharray="8 10" />
                {[82, 198, 292, 322, 462, 110, 392, 556, 118, 414, 570].map((point, index) => (
                  <circle
                    key={`${point}-${index}`}
                    cx={point}
                    cy={[90, 204, 330, 90, 204, 126, 112, 144, 308, 260, 286][index]}
                    r={index < 5 ? 8 : 5}
                    fill={index < 5 ? "#FFFFFF" : "#26B8A6"}
                  />
                ))}
              </svg>

              <div className="relative z-10 grid gap-3 sm:grid-cols-2">
                {aiExamples.map((example) => (
                  <div key={example} className="rounded-[8px] border border-white/10 bg-ink/70 px-4 py-3 text-sm font-semibold text-white/90 backdrop-blur">
                    {example}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
